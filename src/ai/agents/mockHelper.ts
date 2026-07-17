export interface MockData {
  documentType: string;
  suggestedTitle: string;
  category: string;
  tags: string[];
  summary: string;
  keyPoints: string[];
  importantSections: { sectionTitle: string; significance: string }[];
  actionItems: string[];
  dates: string[];
  entities: string[];
}

/**
 * Generates realistic, content-aware mock diagnostics when GEMINI_API_KEY is not defined.
 */
export const getMockAnalysis = (text: string): MockData => {
  const t = (text || '').toLowerCase();
  
  if (t.includes('invoice') || t.includes('billing') || t.includes('payment') || t.includes('amount due') || t.includes('total price') || t.includes('$')) {
    return {
      documentType: 'Invoice / Financial Document',
      suggestedTitle: 'Service Invoice Statement',
      category: 'Finance',
      tags: ['Billing', 'Invoice', 'Finance', 'Payment', 'Statement'],
      summary: `OVERVIEW:\nThis is a financial invoice statement detailing charges for services rendered, including itemized amounts, billing cycles, and total outstanding balances due.\n\nKEY TAKEAWAYS:\n- Itemized list of service hours and rates.\n- Total balance and tax calculations are outlined.\n- Payment due date and bank transfer terms are specified.\n- Late payment policy details.\n- Customer support contact information.`,
      keyPoints: [
        'Itemized service deliverables and associated hours.',
        'Clear breakdown of subtotal, applicable taxes, and final due amount.',
        'Payment terms require bank transfer within 14 days.',
        'Late fees may apply for payments delayed past the grace period.',
        'Accounts team contacts listed for billing inquiries.'
      ],
      importantSections: [
        { sectionTitle: 'Payment Instructions', significance: 'Contains banking details and reference numbers for wire transfers.' },
        { sectionTitle: 'Late Payment Policy', significance: 'Explains penalties and grace periods for overdue invoices.' }
      ],
      actionItems: [
        'Process wire transfer payment of invoice total.',
        'Submit receipt reference to accounts@company.com.',
        'Verify billable hours log against internal timestamps.'
      ],
      dates: ['July 28, 2026', 'August 15, 2026'],
      entities: ['Accounts Department', 'Service Provider Ltd', 'Client Corp']
    };
  }
  
  if (t.includes('agreement') || t.includes('contract') || t.includes('shall') || t.includes('lease') || t.includes('hereby') || t.includes('party')) {
    return {
      documentType: 'Legal Agreement / Contract',
      suggestedTitle: 'Confidential Non-Disclosure Agreement',
      category: 'Legal',
      tags: ['Agreement', 'Contract', 'NDA', 'Compliance', 'Legal'],
      summary: `OVERVIEW:\nThis is a mutual non-disclosure and confidentiality agreement binding the signing parties to protect sensitive business information, intellectual property, and trade secrets.\n\nKEY TAKEAWAYS:\n- Defines what constitutes confidential information.\n- Outlines restrictions on use and disclosure of shared data.\n- Specifies the duration of the confidentiality obligations.\n- Details consequences and remedies in the event of a breach.\n- Governing law and dispute resolution jurisdiction.`,
      keyPoints: [
        'Confidentiality covenants apply mutually to all signing entities.',
        'IP rights are strictly retained by the disclosing party.',
        'Obligation of secrecy survives agreement termination by 5 years.',
        'Breach entitles injured party to seek injunctive relief.',
        'Governing law is set to the local jurisdiction.'
      ],
      importantSections: [
        { sectionTitle: 'Confidentiality Scope', significance: 'Defines exactly what data is protected and what is excluded.' },
        { sectionTitle: 'Remedies for Breach', significance: 'Lists legal options, including damages and restraining orders.' }
      ],
      actionItems: [
        'Obtain authorized signature from legal counsel.',
        'Archive executed copy in secure compliance database.',
        'Set calendar reminder for agreement renewal date.'
      ],
      dates: ['July 18, 2026', 'July 18, 2031'],
      entities: ['Signing Party A', 'Signing Party B', 'Arbitration Court']
    };
  }

  if (t.includes('resume') || t.includes('cv') || t.includes('education') || t.includes('experience') || t.includes('skills') || t.includes('job')) {
    return {
      documentType: 'Professional Resume / CV',
      suggestedTitle: 'Curriculum Vitae Statement',
      category: 'Human Resources',
      tags: ['Resume', 'CV', 'Career', 'Profile', 'Skills'],
      summary: `OVERVIEW:\nThis is a professional resume outlining candidate work experience, educational background, technical skills portfolio, and professional certifications.\n\nKEY TAKEAWAYS:\n- Chronological work history at previous companies.\n- Academic degrees and graduation years.\n- Technical stack and core proficiencies.\n- Industry-recognized certificates and awards.\n- Personal projects and reference contact info.`,
      keyPoints: [
        'Demonstrated experience in software engineering and web technologies.',
        'Holds a bachelor\'s degree in Computer Science.',
        'Proficient in React, Next.js, Node.js, and database design.',
        'Active certification in cloud infrastructure systems.',
        'Proven track record of delivering SaaS projects in team environments.'
      ],
      importantSections: [
        { sectionTitle: 'Work Experience', significance: 'Details professional achievements and responsibilities in past roles.' },
        { sectionTitle: 'Skills Portfolio', significance: 'Highlights programming languages and tools the candidate has mastered.' }
      ],
      actionItems: [
        'Schedule initial screening call with candidate.',
        'Initiate technical coding challenge assessment.',
        'Verify professional employment reference details.'
      ],
      dates: ['June 2022', 'Present'],
      entities: ['Candidate Name', 'Computer Science Department', 'Tech Solutions Inc']
    };
  }

  // Default Fallback
  return {
    documentType: 'Report / Informational Document',
    suggestedTitle: 'Technical Report Overview',
    category: 'Information',
    tags: ['Overview', 'DocuMind', 'Guide', 'Tutorial', 'Reference'],
    summary: `OVERVIEW:\nThis is an informational document outlining general topics, instructions, or conceptual descriptions, capturing key structural guidelines for review.\n\nKEY TAKEAWAYS:\n- Concise overview of the primary subjects discussed.\n- Bulleted list of procedural steps or key findings.\n- Highlights critical guidelines for implementation.\n- Summarizes next steps for researchers or developers.\n- Provides quick links or references for further reading.`,
    keyPoints: [
      'Core subject matter covers technical guidelines and architectures.',
      'Includes practical examples and best practices.',
      'Highlights the importance of database schema alignment.',
      'Suggests setting up modular routing for backend systems.',
      'References further reading materials and online documentation.'
    ],
    importantSections: [
      { sectionTitle: 'Implementation Steps', significance: 'Guides the reader through execution steps chronologically.' },
      { sectionTitle: 'References and Links', significance: 'Provides sources and official docs to verify the contents.' }
    ],
    actionItems: [
      'Read and review the general overview sections.',
      'Check database schema connections are operational.',
      'Create project task list for outstanding deliverables.'
    ],
    dates: [new Date().toLocaleDateString('en-US')],
    entities: ['DocuMind AI', 'Advanced Developer Team', 'Database Registry']
  };
};
