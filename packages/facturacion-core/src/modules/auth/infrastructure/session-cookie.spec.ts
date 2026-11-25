import { readRefreshCookie, refreshCookieOptions, REFRESH_COOKIE_NAME } from './session-cookie';

describe('cookie de sesión', () => {
  it('es httpOnly, solo para /api/v1/auth y lax por defecto', () => {
    expect(refreshCookieOptions({ NODE_ENV: 'production' })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  });

  it('en staging (SameSite=None) siempre es Secure', () => {
    expect(
      refreshCookieOptions({ NODE_ENV: 'development', REFRESH_COOKIE_SAMESITE: 'none' }),
    ).toMatchObject({
      sameSite: 'none',
      secure: true,
    });
  });

  it('en local sin https no exige Secure', () => {
    expect(refreshCookieOptions({ NODE_ENV: 'development' }).secure).toBe(false);
  });

  it('lee solo su cookie', () => {
    const req = {
      headers: { cookie: `otra=1; ${REFRESH_COOKIE_NAME}=abc-123_x; ultima=2` },
    } as any;
    expect(readRefreshCookie(req)).toBe('abc-123_x');
    expect(readRefreshCookie({ headers: {} } as any)).toBeUndefined();
  });
});
