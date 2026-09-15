export type UserRole = "ops_admin" | "lender_admin" | "lender_agent";
export type UserStatus = "invited" | "active" | "disabled";
export type ManagedUser = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lenderId?: string;
  createdAt?: string;
};
