export type Role = 'student' | 'assessor' | 'iqa' | 'admin';

export interface TestUser {
  role: Role;
  email: string;
  password: string;
  storageStatePath: string;
}

const PRIMARY_STUDENT: TestUser = {
  role: 'student',
  email: 'bhatnagar007vidit@gmail.com',
  password: 'password',
  storageStatePath: 'tests/.auth/student.json',
};

export const SECOND_STUDENT: TestUser = {
  role: 'student',
  email: 'intern@learnerseducation.com',
  password: 'password',
  storageStatePath: 'tests/.auth/student2.json',
};

const ASSESSOR: TestUser = {
  role: 'assessor',
  email: 'jyothi@learnerseducation.com',
  password: 'password123',
  storageStatePath: 'tests/.auth/assessor.json',
};

// Reset to `iqapassword` (matches the launch credentials email) via the admin
// reset-password flow — see tests/admin/iqa-password-reset.spec.ts.
const IQA: TestUser = {
  role: 'iqa',
  email: 'iqa@test.com',
  password: 'iqapassword',
  storageStatePath: 'tests/.auth/iqa.json',
};

const ADMIN: TestUser = {
  role: 'admin',
  email: 'admin@learnerseducation.com',
  password: 'passwordadmin',
  storageStatePath: 'tests/.auth/admin.json',
};

export const USERS = {
  student: PRIMARY_STUDENT,
  student2: SECOND_STUDENT,
  assessor: ASSESSOR,
  iqa: IQA,
  admin: ADMIN,
} as const;

export const QUALIFICATION_SLUG =
  'ncfe-level-3-certificate-in-assessing-vocational-achievement';
