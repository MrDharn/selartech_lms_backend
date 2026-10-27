CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of string options
    correct_option INT NOT NULL -- Index of the correct answer
);