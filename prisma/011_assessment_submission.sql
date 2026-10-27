CREATE TABLE assessment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    score INT NOT NULL,
    passed BOOLEAN NOT NULL,
    attempt_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);