export const emptyProfile = (id, name, linkedin, instagram) => ({
  id, name, linkedin, instagram,
  sources: { linkedin: { url: linkedin, text: '' }, instagram: { url: instagram, text: '' } },
  profile: {
    summary: '',
    needs: [], hobbies: [], interests: [], qualities: [],
    work_style: [], social_style: [], date_ideas: [],
    evidence: []
  }
});
