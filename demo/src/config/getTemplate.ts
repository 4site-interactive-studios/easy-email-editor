

import templates from '@demo/config/templates.json';

export async function getTemplate(id: string|number) {
  const item = templates.find(item => item.article_id === +id);
  if (!item) return null;
  let data:any = null;
  switch (item.path) {
    
  case 'EWG Emailify Template.json':
      data = (await import("@demo/templates/EWG Emailify Template.json")).default;
      break;
  
  }
  return data;
}


