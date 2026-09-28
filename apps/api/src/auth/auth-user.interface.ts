export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: Array<{
    code: string;
    organizationId: string | null;
  }>;
  organizationIds: string[];
  permissions: string[];
}
