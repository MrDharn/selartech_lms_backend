CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    pass_score INT DEFAULT 70 -- Passing percentage (e.g., 70%)
);