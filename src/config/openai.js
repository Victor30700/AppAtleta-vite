const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const sendMessageToGPT = async (messageHistory) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo', // o 'gpt-4' si tienes acceso
      messages: messageHistory,
      temperature: 0.7,
    }),
  });

  // Si la respuesta no es exitosa, lanza un error con el mensaje recibido
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Error ${response.status}: ${errorData.error?.message || 'No se pudo obtener respuesta'}`
    );
  }
  
  const data = await response.json();
  // Retorna directamente el contenido del primer mensaje de respuesta
  return data.choices[0].message.content;
};
