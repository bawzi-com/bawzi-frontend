import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/swagger
 * Proxy seguro para a especificação OpenAPI Enterprise do backend.
 * Repassa o Authorization header do cliente → backend.
 */
export async function GET(req: NextRequest) {
  const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  const authorization = req.headers.get('authorization') || '';

  try {
    const res = await fetch(`${backendUrl}/api/enterprise/openapi`, {
      headers: { Authorization: authorization },
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'Erro desconhecido' }));
      return NextResponse.json(body, { status: res.status });
    }

    const spec = await res.json();
    return NextResponse.json(spec);
  } catch {
    return NextResponse.json(
      { detail: 'Não foi possível conectar ao servidor.' },
      { status: 502 },
    );
  }
}
