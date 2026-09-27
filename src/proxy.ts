import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { destinoDaSaida, loginBanido, perfilDesativado } from '@/lib/perfil-desativado'

/**
 * Renova a sessão a cada navegação, barra quem não está logado e tira da
 * sessão quem teve o perfil desativado no Nazo Gestão.
 *
 * O guard vive aqui, e não espalhado pelas páginas, porque no vStoque a
 * checagem de papel dentro do componente criou race condition: havia um
 * render em que o papel ainda era null e o usuário era chutado da tela.
 *
 * (No Next 16 esta convenção passou a se chamar `proxy`; era `middleware`.)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
    error: erroDoLogin,
  } = await supabase.auth.getUser()

  const ehLogin = request.nextUrl.pathname.startsWith('/login')

  // Perfil desativado (docs/perfil-desativado.md no Nazo Gestão). Três
  // caminhos levam à mesma saída — também para a sessão que já estava aberta:
  //  · o login foi banido pela manage-member: o Auth recusa o token (/user) ou
  //    a renovação com `user_banned`, e aí NÃO há usuário para consultar o
  //    perfil — o motivo vem só no erro;
  //  · com a v56, o banco recusa a leitura do perfil (PERFIL_DESATIVADO);
  //  · sem a v56 e sem o banimento, o perfil diz `ativo = false`.
  let desativado = loginBanido(erroDoLogin)
  if (!desativado && user) {
    const { data: perfil, error } = await supabase
      .from('profiles')
      .select('ativo')
      .eq('id', user.id)
      .maybeSingle()
    desativado = perfilDesativado(perfil, error)
  }
  if (desativado) {
    // A saída é local: o Auth recusa o /logout de quem está banido (403), e a
    // biblioteca apaga a sessão (os cookies) mesmo assim.
    await supabase.auth.signOut({ scope: 'local' })
    const destino = destinoDaSaida(ehLogin, request.nextUrl.searchParams.get('desativado'))
    if (!destino) return response
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = '?desativado=1'
    const saida = NextResponse.redirect(url)
    // Os cookies da saída (a sessão apagada) vão junto no redirecionamento.
    response.cookies.getAll().forEach((c) => saida.cookies.set(c))
    return saida
  }

  if (!user && !ehLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && ehLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)'],
}
