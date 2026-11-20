const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export const api = async (url, options = {}) => {
  const token = localStorage.getItem('coy-demo-token');
  const headers = {
    ...(options.headers || {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(`${apiOrigin}${url}`, {
    ...options,
    headers,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};
