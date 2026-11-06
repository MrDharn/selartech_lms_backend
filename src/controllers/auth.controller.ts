import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { OAuth2Client } from 'google-auth-library';


const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);



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
export const register = async (req: Request, res: Response) => {
  const { first_name, last_name, email, password, role } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: 'Full name, email, and password are required' });
  }

  try {
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    // console.log(password_hash)
    const userRole = role === 'INSTRUCTOR' || role === 'ADMIN' ? role : 'STUDENT';

    const newUser = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, first_name, last_name, email, role, created_at`,
      [first_name, last_name, email, password_hash, userRole]
    );

    const user = newUser.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    delete user.password_hash;

    return res.status(200).json({
      message: 'Login successful',
      user,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};