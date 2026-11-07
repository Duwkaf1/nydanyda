export function cinemaSearchTerms(query){
 if(typeof query!=='string'||!query.trim()||query.length>100||/[\u0000-\u001f\u007f]/.test(query))throw new Error('Введи название до 100 символов.');
 const value=query.trim(),normalized=value.toLocaleLowerCase('ru').replace(/[«»"'’]/g,'').replace(/\s+/g,' ');
 const wick=/^(джон(?:\s*[ув]ик)?|john(?:\s*wick)?)(?:\s*\d+)?$/i.test(normalized);
 const aliases=[[/^(континенталь|континентал)$/,'The Continental'],[/^во все тяжкие$/,'Breaking Bad'],[/^игра престолов$/,'Game of Thrones'],[/^одни из нас$/,'The Last of Us'],[/^очень странные дела$/,'Stranger Things'],[/^дюна(?:\s*\d+)?$/,'Dune']];
 const extra=aliases.find(([pattern])=>pattern.test(normalized))?.[1];
 return {terms:[...new Set([value,...(wick?['John Wick','The Continental']:extra?[extra]:[])])],wick};
}
export function rankCinemaSearch(items,query){const {terms,wick}=cinemaSearchTerms(query);const score=item=>{const title=item.title.toLowerCase();if(wick&&/^(?:john wick|джон [ув]ик)(?:$|\s|:)/i.test(title))return 100;if(wick&&item.media==='series'&&/continental|континенталь/i.test(title))return 90;return Math.max(...terms.map(term=>title===term.toLowerCase()?80:title.startsWith(term.toLowerCase())?60:title.includes(term.toLowerCase())?40:0));};return [...items].sort((a,b)=>score(b)-score(a));}
