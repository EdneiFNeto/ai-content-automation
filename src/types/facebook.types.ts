export interface GraphApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

/** `POST /{page-id}/photos` — devolve o id da foto e o id do post no feed. */
export interface PhotoUploadResponse {
  id: string;
  post_id?: string;
}

/** `POST /{page-id}/feed` e `POST /{page-id}/videos` — devolvem só um id. */
export interface FeedPostResponse {
  id: string;
}
