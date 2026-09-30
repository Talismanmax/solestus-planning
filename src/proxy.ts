import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OPENBAAR = ["/inloggen", "/auth/callback"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const pad = request.nextUrl.pathname;
  const openbaar = OPENBAAR.some((p) => pad === p || pad.startsWith(p + "/"));

  if (!data.user && !openbaar) {
    const url = request.nextUrl.clone();
    url.pathname = "/inloggen";
    // Had iemand een sessie-cookie maar is die niet meer geldig: sessie verlopen.
    const hadSessie = request.cookies.getAll().some((c) => c.name.includes("-auth-token"));
    const terug = pad !== "/" ? `volgende=${encodeURIComponent(pad + request.nextUrl.search)}` : "";
    url.search = hadSessie ? `?staat=verlopen${terug ? `&${terug}` : ""}` : terug ? `?${terug}` : "";
    return NextResponse.redirect(url);
  }

  // Ingelogd bij Microsoft maar geen toegang tot de planning (geen gebruiker): uitloggen en de melding tonen,
  // in plaats van heen en weer te sturen tussen /inloggen en de planning.
  if (data.user && pad === "/inloggen" && request.nextUrl.searchParams.get("staat") === "mislukt") {
    await supabase.auth.signOut();
    return response;
  }

  if (data.user && pad === "/inloggen") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts|favicon.ico|.*\\.(?:svg|png|jpg|ico|ttf|otf|woff2)$).*)"],
};
