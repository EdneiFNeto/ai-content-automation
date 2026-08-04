export interface GraphApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export interface CreateMediaContainerResponse {
  id: string;
}

export interface PublishMediaResponse {
  id: string;
}

export type MediaContainerStatus = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

export interface MediaContainerStatusResponse {
  status_code?: MediaContainerStatus;
}
