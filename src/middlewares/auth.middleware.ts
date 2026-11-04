import { Request,Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {AuthenticatedRequest, TokenPayload } from '../types';
import { OAuth2Client } from 'google-auth-library';
import {db} from '../config/db'
import bcrypt from 'bcrypt'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
):void=> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
     res.status(401).json({ message: 'Access token missing' });
     return
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token' });
    return
  }
};


export const googleAuth = async (req:Request, res:Response)=>{
  const {id_token, role} = req.body

  if(!id_token){
    return res.status(400).json({message: 'GOOGLE ID token is Required'})

  }

  try{
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload();
    if(!payload || !payload.email){
      return res.status(400).json({message: 'Invalid Google token payload'})
    }

    const {email, name} = payload
    const userRole = role === "INSTRUCTOR" || role === "ADMIN" ? role: "STUDENT"

    const existingUser  = await db.query('SELECT id, full_name, email , role, created_at FROM users WHERE email = $1', [email])


    let user;
    if(existingUser.rows.length > 0){
      user = existingUser.rows[0]
    }else{
      const dummyPasswordHash = await bcrypt.hash(`GOOGLE_OAUTH_${Date.now()}_${Math.random()}`, 10)

      const newUser = await db.query(
        `INSERT INTO users(full_name, email, password_hash,role) VALUES($1,$2,$3,$4)
        RETURNING id, full_name, email, role, created_at`, [name || 'Google user', email, dummyPasswordHash, userRole]
      )

      user = newUser.rows[0]
    }

    const token = jwt.sign({id: user.id, role: user.role}, JWT_SECRET, {expiresIn: '7d'})

    return res.status(200).json({
      message: "Google authentication successful",
      user,
      token
    })
  }catch(err){
    console.error('Google Auth Error:', err)
    return res.status(401).json({
      message: "Google Authentication failed"
    })
  }
}