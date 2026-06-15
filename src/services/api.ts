// src/services/api.ts
import { apiFetch, SessionExpiredError } from '@/lib/apiClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchUserProfile() {
  // 🟢 Adicionada a barra "/" entre o URL e a rota
  try {
    const response = await apiFetch(`${API_URL}/api/users/me`);
    if (!response.ok) throw new Error('Falha ao buscar perfil');
    return response.json();
  } catch (err) {
    if (err instanceof SessionExpiredError) return;
    throw err;
  }
}

export async function updateUserProfile(companyData: any) {
  // 🟢 Adicionada a barra "/" entre o URL e a rota
  try {
    const response = await apiFetch(`${API_URL}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ company: companyData })
    });
    if (!response.ok) throw new Error('Falha ao atualizar perfil');
    return response.json();
  } catch (err) {
    if (err instanceof SessionExpiredError) return;
    throw err;
  }
}