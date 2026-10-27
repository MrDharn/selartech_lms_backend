CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    "order" INT NOT NULL,
    is_free BOOLEAN DEFAULT FALSE
);