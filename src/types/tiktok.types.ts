export interface TikTokApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
}

// SELF_ONLY é o único nível permitido para apps ainda não auditados pelo TikTok
// (ver TikTokService) — os demais exigem aprovação de "Content Posting API".
export type TikTokPrivacyLevel =
  'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';

export interface InitVideoPublishResponse {
  data?: {
    publish_id: string;
  };
}

// PROCESSING_DOWNLOAD/PROCESSING_UPLOAD são intermediários (aguardando);
// SEND_TO_USER_INBOX ocorre em apps não auditados (vídeo cai como rascunho
// no app do criador em vez de publicar direto); os demais são terminais.
export type TikTokPublishStatus =
  | 'PROCESSING_DOWNLOAD'
  | 'PROCESSING_UPLOAD'
  | 'SEND_TO_USER_INBOX'
  | 'PUBLISH_COMPLETE'
  | 'FAILED';

export interface PublishStatusResponse {
  data?: {
    status: TikTokPublishStatus;
    fail_reason?: string;
  };
}

export interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
}
