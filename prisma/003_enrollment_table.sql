CREATE TYPE enrollment_status AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'EXPIRED');

CREATE TABLE enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    access_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    grace_period_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status enrollment_status DEFAULT 'ACTIVE',
    UNIQUE(student_id, course_id)
);

