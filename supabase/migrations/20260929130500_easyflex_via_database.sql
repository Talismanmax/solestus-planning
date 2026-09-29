-- Easyflex2go-aanvragen vanuit de database, zodat ze altijd van hetzelfde IP-adres komen
-- (uitgaand IP van de database: 63.186.227.188, staat op de IP-whitelist van het token).
create extension if not exists http with schema extensions;

create or replace function public.easyflex_ophalen(pad text, token text, afzender text, extra text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  alles jsonb := '[]'::jsonb;
  cursor_hash text := null;
  antwoord extensions.http_response;
  body jsonb;
  url text;
  i int := 0;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  loop
    i := i + 1;
    exit when i > 400;
    url := 'https://solestus.easyflex2go.nl/api/v1' || pad || '?per_page=50' || extra
           || coalesce('&cursor=' || extensions.urlencode(cursor_hash), '');
    antwoord := extensions.http((
      'GET', url,
      array[
        extensions.http_header('Authorization', 'Bearer ' || token),
        extensions.http_header('From', afzender),
        extensions.http_header('Accept', 'application/json')
      ],
      null, null
    )::extensions.http_request);
    if antwoord.status <> 200 then
      raise exception 'EASYFLEX_HTTP_% %', antwoord.status, left(antwoord.content, 300);
    end if;
    body := antwoord.content::jsonb;
    alles := alles || coalesce(body->'data', '[]'::jsonb);
    cursor_hash := body->'pagination'->>'next_hash';
    exit when cursor_hash is null;
  end loop;
  return alles;
end;
$$;

revoke all on function public.easyflex_ophalen(text, text, text, text) from public, anon, authenticated;
grant execute on function public.easyflex_ophalen(text, text, text, text) to service_role;
