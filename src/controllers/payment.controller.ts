import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../types';

// 1. Initialize Paystack Transaction
export const initializePayment = async (req: AuthenticatedRequest, res: Response) => {
  const studentId = req.user?.id;
  const { course_id } = req.body;

  if (!course_id) {
    return res.status(400).json({ message: 'course_id is required' });
  }

  try {
    // Get course details
    const courseRes = await db.query('SELECT price_ngn, title FROM courses WHERE id = $1', [course_id]);
    if (courseRes.rows.length === 0) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const userRes = await db.query('SELECT email FROM users WHERE id = $1', [studentId]);
    const studentEmail = userRes.rows[0].email;
    const course = courseRes.rows[0];

    const reference = `REF_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    // Save pending payment
    await db.query(
      `INSERT INTO payments (student_id, course_id, reference, amount, status)
       VALUES ($1, $2, $3, $4, 'PENDING')`,
      [studentId, course_id, reference, course.price_ngn]
    );

    // Call Paystack API
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: studentEmail,
        amount: Math.round(course.price_ngn * 100), // Convert NGN to Kobo
        reference,
        metadata: {
          studentId,
          courseId: course_id,
        },
      }),
    });

     interface PaystackInitializeResponse {
      status: boolean;
      message: string;
      data: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    }


    const data = await response.json() as PaystackInitializeResponse;

    if (!data.status) {
      return res.status(400).json({ message: 'Failed to initialize Paystack transaction', error: data.message });
    }

    return res.status(200).json({
      authorization_url: data.data.authorization_url,
      reference,
    });
  } catch (error) {
    console.error('Error initializing payment:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// 2. Handle Paystack Webhook
export const handlePaystackWebhook = async (req: Request, res: Response) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data;
    const { studentId, courseId } = metadata;

    const startDate = new Date();
    
    // Calculate +3 Months Main Access
    const accessEndDate = new Date(startDate);
    accessEndDate.setMonth(accessEndDate.getMonth() + 3);

    // Calculate +4 Months Total (3 Months + 1 Month Grace)
    const gracePeriodEndDate = new Date(startDate);
    gracePeriodEndDate.setMonth(gracePeriodEndDate.getMonth() + 4);

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Update payment record
      await client.query(`UPDATE payments SET status = 'SUCCESSFUL' WHERE reference = $1`, [reference]);

      // Insert or update active enrollment
      await client.query(
        `INSERT INTO enrollments (student_id, course_id, access_start_date, access_end_date, grace_period_end_date, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (student_id, course_id) 
         DO UPDATE SET 
           access_start_date = EXCLUDED.access_start_date,
           access_end_date = EXCLUDED.access_end_date,
           grace_period_end_date = EXCLUDED.grace_period_end_date,
           status = 'ACTIVE'`,
        [studentId, courseId, startDate, accessEndDate, gracePeriodEndDate]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Webhook transaction failed:', error);
      return res.status(500).send('Database transaction failed');
    } finally {
      client.release();
    }
  }

  return res.status(200).send('Webhook processed');
};