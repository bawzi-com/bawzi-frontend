// app/api/swagger/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // Puxa as credenciais que você definiu no .env da Vercel
  const username = process.env.DOCS_USERNAME || 'bawzi_admin';
  const password = process.env.DOCS_PASSWORD || 'sua_senha_aqui';
  
  // Transforma em Base64 para o padrão Basic Auth
  const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

  try {
    // Faz o fetch secreto ao backend em Python
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/openapi.json`, {
      headers: {
        'Authorization': `Basic ${basicAuth}`
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error('Falha ao aceder à API');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
}