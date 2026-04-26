import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete('uwc_marketing_session', { path: '/' })
  return redirect('/cdn-cgi/access/logout')
}
