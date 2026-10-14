let tokenProvider:(()=>Promise<string>)|null=null;
export function setAccessTokenProvider(provider:(()=>Promise<string>)|null){tokenProvider=provider;}
export async function authHeaders():Promise<Record<string,string>>{
  if(!tokenProvider)return {};
  return {Authorization:`Bearer ${await tokenProvider()}`};
}
