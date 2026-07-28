export type CustomerAccount = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
};

export type CustomerRecord = CustomerAccount & {
  passwordHash: string;
};

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};
