// src/services/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchUserProfile(token: string) {
  const response = await fetch(`${API_URL}api/users/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) throw new Error('Falha ao buscar perfil');
  return response.json();
}

export async function updateUserProfile(token: string, companyData: any) {
  const response = await fetch(`${API_URL}/api/users/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ company: companyData })
  });
  
  if (!response.ok) throw new Error('Falha ao atualizar perfil');
  return response.json();
}