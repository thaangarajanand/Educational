export const studyResources: Record<string, { title: string; summary: string; link?: string }[]> = {
  math: [
    { title: 'Solving linear equations', summary: 'Step-by-step: isolate variables, combine like terms, divide to find the unknown.' },
    { title: 'Practice: Algebra basics', summary: 'Try solving 10 linear equations with one variable. Focus on isolating x.' },
  { title: 'Resource: Khan Academy - Algebra', summary: 'Free video lessons and practice exercises for algebra topics.', link: 'https://www.khanacademy.org/math/algebra' }
  ],
  physics: [
    { title: 'Newton’s Laws', summary: 'Understand inertia, F=ma, and action-reaction pairs. Practice free-body diagrams.' },
    { title: 'Example problems: Kinematics', summary: 'Work through problems involving constant acceleration.' },
  { title: 'Resource: HyperPhysics', summary: 'Concise physics explanations and diagrams for core topics.', link: 'http://hyperphysics.phy-astr.gsu.edu' }
  ],
  study_skills: [
    { title: 'Pomodoro Technique', summary: 'Study for 25 minutes, break for 5. Repeat 4 times then take a longer break.' },
    { title: 'Active Recall', summary: 'Test yourself frequently instead of passively rereading notes.' },
    { title: 'Spaced Repetition', summary: 'Review material at increasing intervals to move knowledge to long-term memory.' }
  ]
};
