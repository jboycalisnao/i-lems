export interface RegistrarSection {
  id: string;
  name: string | null;
  grade_level: string | null;
  adviser_name: string | null;
  strand: string | null;
  school_year_id: string | null;
  // Fallback compatibility keys
  gradeLevel?: string | null;
  adviserName?: string | null;
  schoolYearId?: string | null;
  section_name?: string | null;
  adviser?: string | null;
}

export interface RegistrarLearner {
  id: string;
  lrn: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  gender: string | null;
  birth_date: string | null;
  status: string | null;
  section_id: string | null;
  rfid?: string | null;
  contact_number?: string | null;
  guardian_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  
  // Fallback keys for legacy tables (e.g. students)
  name?: string | null;
  grade_level?: string | null;
  section?: string | null;

  // Enriched client-side attributes
  section_name?: string;
  full_name?: string;
}

export interface RosterCachePayload {
  learners: RegistrarLearner[];
  sections: RegistrarSection[];
  cachedAt: string; // ISO timestamp
  version: number;
}
