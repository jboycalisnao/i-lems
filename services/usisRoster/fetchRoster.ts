import { SupabaseClient } from '@supabase/supabase-js';
import { RegistrarLearner, RegistrarSection } from './types';

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from the first available table candidate using range pagination.
 * Bypasses PostgREST 1,000-row default limit.
 * Strictly read-only (.select only).
 */
async function fetchAllRowsWithFallback<T>(
  supabase: SupabaseClient,
  tableCandidates: string[]
): Promise<T[]> {
  let activeTable: string | null = null;

  for (const table of tableCandidates) {
    try {
      const { error: probeError } = await supabase.from(table).select('id').limit(1);
      if (!probeError) {
        activeTable = table;
        console.log(`[USIS Fetcher] Connected to master table "${table}".`);
        break;
      }
      console.warn(`[USIS Fetcher] Probe table "${table}" failed: ${probeError.message}`);
    } catch (e: any) {
      console.warn(`[USIS Fetcher] Probe table "${table}" exception: ${e?.message}`);
    }
  }

  if (!activeTable) {
    console.warn(`[USIS Fetcher] None of table candidates [${tableCandidates.join(', ')}] are accessible.`);
    return [];
  }

  let allRecords: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(activeTable)
      .select('*')
      .range(from, to);

    if (error) {
      console.error(`[USIS Fetcher] Range query failed on ${activeTable}: ${error.message}`);
      throw new Error(`Failed to fetch from ${activeTable}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRecords = allRecords.concat(data as T[]);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allRecords;
}

/**
 * Normalizes learner data and links section titles and grade levels.
 * Handles both modern registrar_* schema and legacy student tables.
 */
export const enrichRosterData = (
  learners: RegistrarLearner[],
  sections: RegistrarSection[]
): RegistrarLearner[] => {
  const sectionMap = new Map<string, RegistrarSection>();
  for (const s of sections) {
    if (s.id) {
      sectionMap.set(String(s.id).trim(), s);
    }
    const secName = s.name || s.section_name;
    if (secName) {
      sectionMap.set(String(secName).trim().toLowerCase(), s);
    }
  }

  return learners.map((learner) => {
    const sId = String(learner.section_id || '').trim();
    const sNameFallback = String(learner.section || learner.section_name || '').trim().toLowerCase();
    const section = (sId ? sectionMap.get(sId) : undefined) || (sNameFallback ? sectionMap.get(sNameFallback) : undefined);

    const gradeLevel = section
      ? section.grade_level || section.gradeLevel || 'Unspecified Grade'
      : learner.grade_level || 'Unspecified Grade';

    const sectionName = section
      ? section.name || section.section_name || 'Unnamed Section'
      : learner.section || learner.section_name || 'No Section Assigned';

    let fullName = '';
    if (learner.first_name || learner.last_name) {
      const firstName = learner.first_name || '';
      const lastName = learner.last_name || '';
      const middleName = learner.middle_name ? ` ${learner.middle_name}` : '';
      fullName = `${lastName}, ${firstName}${middleName}`.trim();
    } else if (learner.name) {
      fullName = learner.name.trim();
    } else {
      fullName = 'Unnamed Learner';
    }

    const cleanLrn = learner.lrn ? String(learner.lrn).trim() : null;
    const cleanRfid = learner.rfid ? String(learner.rfid).trim().toUpperCase() : null;

    return {
      ...learner,
      lrn: cleanLrn,
      rfid: cleanRfid,
      section_name: sectionName,
      grade_level: gradeLevel,
      full_name: fullName,
    };
  });
};

/**
 * Executes a strictly read-only fetch of learners and sections from Supabase.
 */
export const fetchRosterFromSupabase = async (
  supabase: SupabaseClient
): Promise<{ learners: RegistrarLearner[]; sections: RegistrarSection[] }> => {
  const [sectionsRaw, learnersRaw] = await Promise.all([
    fetchAllRowsWithFallback<RegistrarSection>(supabase, ['registrar_sections', 'sections']),
    fetchAllRowsWithFallback<RegistrarLearner>(supabase, ['registrar_learners', 'learners', 'students']),
  ]);

  const enrichedLearners = enrichRosterData(learnersRaw, sectionsRaw);

  return {
    learners: enrichedLearners,
    sections: sectionsRaw,
  };
};
