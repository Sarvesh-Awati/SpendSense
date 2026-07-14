export interface UserPayload {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}
