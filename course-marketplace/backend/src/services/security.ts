import jwt from 'jsonwebtoken';import crypto from 'node:crypto';
export type Role='student'|'teacher'|'moderator';export type AuthUser={id:number;role:Role};
const accessSecret=()=>process.env.JWT_ACCESS_SECRET || 'development-access-secret-change-this';
const refreshSecret=()=>process.env.JWT_REFRESH_SECRET || 'development-refresh-secret-change-this';
export function signAccess(user:AuthUser){return jwt.sign(user,accessSecret(),{expiresIn:'15m'});}
export function signRefresh(user:AuthUser){return jwt.sign(user,refreshSecret(),{expiresIn:'7d'});}
export function verifyAccess(token:string):AuthUser{return jwt.verify(token,accessSecret()) as AuthUser;}
export function verifyRefresh(token:string):AuthUser{return jwt.verify(token,refreshSecret()) as AuthUser;}
export function hashToken(token:string){return crypto.createHash('sha256').update(token).digest('hex');}
export function canManageCourse(role:Role,userId:number,teacherId:number){return role==='moderator'||(role==='teacher'&&userId===teacherId);}
export function pageParams(pageRaw:unknown, limitRaw:unknown){const page=Math.max(1,Math.min(100000,Number(pageRaw)||1));const limit=Math.max(1,Math.min(30,Number(limitRaw)||9));return {page,limit,offset:(page-1)*limit};}
