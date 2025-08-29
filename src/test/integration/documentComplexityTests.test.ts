import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConcurrentBatchProcessor } from '../../services/batchProcessor';
import { MammothDocumentParser } from '../../services/documentParser';
import { WordContentProcessor } from '../../services/contentProcessor';
import { MultiFormatConverter } from '../../services/formatConverter';
import { ProcessingOptions, StructuredContent } from '../../models';

// Mock the services for controlled testing
vi.mock('../../services/documentParser');
vi.mock('../../services/contentProcessor');
vi.mock('../../services/formatConverter');

describe('Document Complexity and Quality Tests', () => {
  let batchProcessor: ConcurrentBatchProcessor;
  let mockParser: MammothDocumentParser;
  let mockContentProcessor: WordContentProcessor;
  let mockFormatConverter: MultiFormatConverter;

  beforeEach(() => {
    // Initialize services
    batchProcessor = new ConcurrentBatchProcessor(2, 100);
    
    mockParser = {
      parseDocument: vi.fn(),
      validateDocument: vi.fn(),
      getSupportedFormats: vi.fn().mockReturnValue(['.docx']),
      isFormatSupported: vi.fn().mockReturnValue(true)
    } as any;

    mockContentProcessor = {
      cleanContent: vi.fn(),
      preserveStructure: vi.fn(),
      stripFormatting: vi.fn(),
      extractTextContent: vi.fn()
    } as any;

    mockFormatConverter = {
      toPlainText: vi.fn(),
      toHTML: vi.fn(),
      toMarkdown: vi.fn(),
      toCustomFormat: vi.fn(),
      getAvailableFormats: vi.fn().mockReturnValue(['plaintext', 'html', 'markdown'])
    } as any;

    // Replace internal services
    (batchProcessor as any).documentParser = mockParser;
    (batchProcessor as any).contentProcessor = mockContentProcessor;
    (batchProcessor as any).formatConverter = mockFormatConverter;
  });

  describe('Simple Legal Document Processing', () => {
    it('should process basic contract with standard formatting', async () => {
      const simpleContractContent: StructuredContent = {
        title: 'Simple Service Agreement',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'Simple Service Agreement',
            children: []
          },
          {
            type: 'paragraph',
            content: 'This agreement is entered into between the Service Provider and the Client.',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: 'Terms and Conditions',
            children: []
          },
          {
            type: 'list',
            content: 'The following terms apply:',
            children: [
              {
                type: 'paragraph',
                content: 'Services will be provided as described',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Payment is due within 30 days',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Either party may terminate with 30 days notice',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 120,
          originalFormat: 'docx',
          warnings: [],
          errors: []
        }
      };

      // Mock successful parsing and processing
      mockParser.parseDocument.mockResolvedValue({
        metadata: { filename: 'simple-contract.docx', fileSize: 25000 },
        content: [],
        styles: [],
        images: []
      });

      mockContentProcessor.cleanContent.mockResolvedValue(simpleContractContent);

      // Mock format conversion
      mockFormatConverter.toHTML.mockReturnValue(
        '<h1>Simple Service Agreement</h1>\n<p>This agreement is entered into between the Service Provider and the Client.</p>\n<h2>Terms and Conditions</h2>\n<p>The following terms apply:</p>\n<ul>\n<li>Services will be provided as described</li>\n<li>Payment is due within 30 days</li>\n<li>Either party may terminate with 30 days notice</li>\n</ul>'
      );

      mockFormatConverter.toMarkdown.mockReturnValue(
        '# Simple Service Agreement\n\nThis agreement is entered into between the Service Provider and the Client.\n\n## Terms and Conditions\n\nThe following terms apply:\n\n- Services will be provided as described\n- Payment is due within 30 days\n- Either party may terminate with 30 days notice'
      );

      mockFormatConverter.toPlainText.mockReturnValue(
        'Simple Service Agreement\n\nThis agreement is entered into between the Service Provider and the Client.\n\nTerms and Conditions\n\nThe following terms apply:\n• Services will be provided as described\n• Payment is due within 30 days\n• Either party may terminate with 30 days notice'
      );

      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: false,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      const result = await batchProcessor.processFilePaths(['/test/simple-contract.docx'], options);

      expect(result.successfulFiles).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output?.title).toBe('Simple Service Agreement');
      expect(result.results[0].output?.sections).toHaveLength(4);

      // Verify format conversion quality
      const htmlOutput = mockFormatConverter.toHTML(simpleContractContent);
      expect(htmlOutput).toContain('<h1>Simple Service Agreement</h1>');
      expect(htmlOutput).toContain('<ul>');
      expect(htmlOutput).toContain('<li>Services will be provided as described</li>');

      const markdownOutput = mockFormatConverter.toMarkdown(simpleContractContent);
      expect(markdownOutput).toContain('# Simple Service Agreement');
      expect(markdownOutput).toContain('- Services will be provided as described');

      const plainTextOutput = mockFormatConverter.toPlainText(simpleContractContent);
      expect(plainTextOutput).toContain('Simple Service Agreement');
      expect(plainTextOutput).toContain('• Services will be provided as described');
    });
  });

  describe('Complex Legal Document Processing', () => {
    it('should handle complex contract with nested sections and tables', async () => {
      const complexContractContent: StructuredContent = {
        title: 'Master Service Agreement with Exhibits',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'Master Service Agreement with Exhibits',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: 'Article I: Definitions and Interpretation',
            children: []
          },
          {
            type: 'paragraph',
            content: 'For the purposes of this Agreement, the following terms shall have the meanings set forth below:',
            children: []
          },
          {
            type: 'list',
            content: 'Definitions:',
            children: [
              {
                type: 'paragraph',
                content: '"Affiliate" means, with respect to any Person, any other Person that directly or indirectly controls, is controlled by, or is under common control with, such Person.',
                children: []
              },
              {
                type: 'paragraph',
                content: '"Agreement" means this Master Service Agreement, as it may be amended, modified, or supplemented from time to time.',
                children: []
              },
              {
                type: 'paragraph',
                content: '"Confidential Information" means all non-public, proprietary, or confidential information disclosed by one Party to the other.',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: 'Article II: Scope of Services',
            children: []
          },
          {
            type: 'heading',
            level: 3,
            content: '2.1 Service Categories',
            children: []
          },
          {
            type: 'paragraph',
            content: 'The Service Provider shall provide services in the following categories:',
            children: []
          },
          {
            type: 'table',
            content: 'Service Categories and Descriptions',
            children: [
              {
                type: 'paragraph',
                content: 'Category | Description | SLA | Pricing Model',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Consulting | Strategic advisory services | 5 business days | Time & Materials',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Implementation | Technical deployment and configuration | 10 business days | Fixed Price',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Support | Ongoing maintenance and support | 4 hours | Monthly Retainer',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Training | User training and documentation | 2 business days | Per Session',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 3,
            content: '2.2 Service Level Agreements',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Service Provider agrees to meet the following service level commitments:',
            children: []
          },
          {
            type: 'list',
            content: 'SLA Commitments:',
            children: [
              {
                type: 'paragraph',
                content: 'Response Time: Initial response within 4 hours for critical issues',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Resolution Time: 99% of issues resolved within agreed timeframes',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Availability: 99.9% uptime for all hosted services',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Performance: All services must meet or exceed baseline performance metrics',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: 'Article III: Financial Terms',
            children: []
          },
          {
            type: 'table',
            content: 'Payment Schedule and Terms',
            children: [
              {
                type: 'paragraph',
                content: 'Payment Type | Frequency | Due Date | Late Fee',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Monthly Retainer | Monthly | 1st of month | 1.5% per month',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Project Milestone | Per milestone | Within 30 days | 1.5% per month',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Expense Reimbursement | Monthly | Within 45 days | N/A',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 450,
          originalFormat: 'docx',
          warnings: ['Complex table structures simplified'],
          errors: []
        }
      };

      // Mock complex document parsing
      mockParser.parseDocument.mockResolvedValue({
        metadata: { filename: 'complex-contract.docx', fileSize: 150000 },
        content: [],
        styles: [],
        images: []
      });

      mockContentProcessor.cleanContent.mockResolvedValue(complexContractContent);

      // Mock format conversion for complex content
      mockFormatConverter.toHTML.mockReturnValue(
        '<h1>Master Service Agreement with Exhibits</h1>\n<h2>Article I: Definitions and Interpretation</h2>\n<p>For the purposes of this Agreement, the following terms shall have the meanings set forth below:</p>\n<p>Definitions:</p>\n<ul>\n<li>"Affiliate" means, with respect to any Person, any other Person that directly or indirectly controls, is controlled by, or is under common control with, such Person.</li>\n<li>"Agreement" means this Master Service Agreement, as it may be amended, modified, or supplemented from time to time.</li>\n<li>"Confidential Information" means all non-public, proprietary, or confidential information disclosed by one Party to the other.</li>\n</ul>\n<h2>Article II: Scope of Services</h2>\n<h3>2.1 Service Categories</h3>\n<p>The Service Provider shall provide services in the following categories:</p>\n<table>\n<caption>Service Categories and Descriptions</caption>\n<tr><th>Category</th><th>Description</th><th>SLA</th><th>Pricing Model</th></tr>\n<tr><td>Consulting</td><td>Strategic advisory services</td><td>5 business days</td><td>Time & Materials</td></tr>\n<tr><td>Implementation</td><td>Technical deployment and configuration</td><td>10 business days</td><td>Fixed Price</td></tr>\n<tr><td>Support</td><td>Ongoing maintenance and support</td><td>4 hours</td><td>Monthly Retainer</td></tr>\n<tr><td>Training</td><td>User training and documentation</td><td>2 business days</td><td>Per Session</td></tr>\n</table>'
      );

      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: true,
        cleanupLevel: 'standard',
        customSettings: {}
      };

      const result = await batchProcessor.processFilePaths(['/test/complex-contract.docx'], options);

      expect(result.successfulFiles).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output?.title).toBe('Master Service Agreement with Exhibits');
      expect(result.results[0].output?.sections).toHaveLength(13); // Multiple sections and subsections
      expect(result.results[0].output?.metadata.warnings).toContain('Complex table structures simplified');

      // Verify complex structure preservation
      const htmlOutput = mockFormatConverter.toHTML(complexContractContent);
      expect(htmlOutput).toContain('<h1>Master Service Agreement with Exhibits</h1>');
      expect(htmlOutput).toContain('<h2>Article I: Definitions and Interpretation</h2>');
      expect(htmlOutput).toContain('<h3>2.1 Service Categories</h3>');
      expect(htmlOutput).toContain('<table>');
      expect(htmlOutput).toContain('<caption>Service Categories and Descriptions</caption>');
      expect(htmlOutput).toContain('<th>Category</th>');
      expect(htmlOutput).toContain('<td>Consulting</td>');
    });

    it('should handle heavily formatted document with mixed content types', async () => {
      const heavyFormattingContent: StructuredContent = {
        title: 'Corporate Policy Manual - Employee Handbook',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'Corporate Policy Manual - Employee Handbook',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Effective Date: January 1, 2025 | Version 3.2 | Approved by: Board of Directors',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: 'Section 1: Code of Conduct and Ethics',
            children: []
          },
          {
            type: 'heading',
            level: 3,
            content: '1.1 Ethical Standards',
            children: []
          },
          {
            type: 'paragraph',
            content: 'All employees are expected to maintain the highest standards of ethical conduct in all business activities.',
            children: []
          },
          {
            type: 'list',
            content: 'Core ethical principles include:',
            children: [
              {
                type: 'paragraph',
                content: 'Integrity: Acting honestly and transparently in all dealings',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Respect: Treating all individuals with dignity and fairness',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Accountability: Taking responsibility for actions and decisions',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Excellence: Striving for the highest quality in all work',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 3,
            content: '1.2 Conflict of Interest Policy',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Employees must avoid situations where personal interests conflict with company interests.',
            children: []
          },
          {
            type: 'table',
            content: 'Conflict of Interest Examples and Actions',
            children: [
              {
                type: 'paragraph',
                content: 'Situation | Risk Level | Required Action | Approval Authority',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Financial interest in supplier | High | Full disclosure and recusal | Ethics Committee',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Family member as vendor | Medium | Disclosure and monitoring | Direct Manager',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Outside board position | Medium | Pre-approval required | HR Director',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Gifts from clients | Low | Report if over $50 | Direct Manager',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: 'Section 2: Workplace Policies',
            children: []
          },
          {
            type: 'heading',
            level: 3,
            content: '2.1 Anti-Discrimination and Harassment',
            children: []
          },
          {
            type: 'paragraph',
            content: 'The company is committed to providing a workplace free from discrimination and harassment.',
            children: []
          },
          {
            type: 'list',
            content: 'Protected characteristics include:',
            children: [
              {
                type: 'paragraph',
                content: 'Race, color, religion, sex, national origin',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Age, disability, veteran status',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Sexual orientation, gender identity',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Genetic information, pregnancy status',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 3,
            content: '2.2 Reporting Procedures',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Employees who experience or witness violations should report them immediately through the following channels:',
            children: []
          },
          {
            type: 'table',
            content: 'Reporting Channels and Contact Information',
            children: [
              {
                type: 'paragraph',
                content: 'Method | Contact | Availability | Confidentiality',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Direct Manager | Immediate supervisor | Business hours | Limited',
                children: []
              },
              {
                type: 'paragraph',
                content: 'HR Department | hr@company.com | Business hours | Confidential',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Ethics Hotline | 1-800-ETHICS | 24/7 | Anonymous',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Online Portal | ethics.company.com | 24/7 | Anonymous',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 380,
          originalFormat: 'docx',
          warnings: [
            'Heavy formatting removed',
            'Multiple font styles normalized',
            'Color coding converted to text emphasis'
          ],
          errors: []
        }
      };

      // Mock heavily formatted document
      mockParser.parseDocument.mockResolvedValue({
        metadata: { filename: 'employee-handbook.docx', fileSize: 200000 },
        content: [],
        styles: [],
        images: []
      });

      mockContentProcessor.cleanContent.mockResolvedValue(heavyFormattingContent);

      const options: ProcessingOptions = {
        outputFormat: 'markdown',
        preserveImages: false,
        includeMetadata: true,
        cleanupLevel: 'aggressive', // More aggressive cleanup for heavily formatted docs
        customSettings: {}
      };

      const result = await batchProcessor.processFilePaths(['/test/employee-handbook.docx'], options);

      expect(result.successfulFiles).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output?.title).toBe('Corporate Policy Manual - Employee Handbook');
      expect(result.results[0].output?.sections).toHaveLength(16);
      expect(result.results[0].output?.metadata.warnings).toHaveLength(3);
      expect(result.results[0].output?.metadata.warnings).toContain('Heavy formatting removed');
    });
  });

  describe('Document Type Variety Testing', () => {
    it('should handle legal brief with citations and footnotes', async () => {
      const legalBriefContent: StructuredContent = {
        title: 'Motion for Summary Judgment - Case No. 2025-CV-001',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'Motion for Summary Judgment - Case No. 2025-CV-001',
            children: []
          },
          {
            type: 'paragraph',
            content: 'TO THE HONORABLE COURT:',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Plaintiff respectfully moves this Court for summary judgment pursuant to Rule 56 of the Federal Rules of Civil Procedure.',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: 'I. STATEMENT OF FACTS',
            children: []
          },
          {
            type: 'paragraph',
            content: 'The material facts, viewed in the light most favorable to the non-moving party, establish the following:',
            children: []
          },
          {
            type: 'list',
            content: 'Undisputed Facts:',
            children: [
              {
                type: 'paragraph',
                content: 'On January 15, 2024, Defendant entered into a written contract with Plaintiff (Exhibit A).',
                children: []
              },
              {
                type: 'paragraph',
                content: 'The contract required Defendant to deliver goods by March 1, 2024 (Contract § 3.1).',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Defendant failed to deliver any goods by the contractual deadline (Plaintiff Aff. ¶ 12).',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Plaintiff provided written notice of breach on March 5, 2024 (Exhibit B).',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: 'II. LEGAL STANDARD',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Summary judgment is appropriate when "there is no genuine dispute as to any material fact and the movant is entitled to judgment as a matter of law." Fed. R. Civ. P. 56(a).',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: 'III. ARGUMENT',
            children: []
          },
          {
            type: 'heading',
            level: 3,
            content: 'A. Defendant Materially Breached the Contract',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Under applicable state law, a material breach occurs when a party\'s failure to perform "defeats the essential purpose of the contract." Smith v. Jones, 123 F.3d 456, 460 (5th Cir. 2020).',
            children: []
          },
          {
            type: 'table',
            content: 'Case Law Analysis',
            children: [
              {
                type: 'paragraph',
                content: 'Case | Court | Year | Holding | Relevance',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Smith v. Jones | 5th Cir. | 2020 | Material breach standard | Direct precedent',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Brown v. Davis | State Sup. Ct. | 2019 | Time is of essence | Contract interpretation',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Wilson v. Taylor | Fed. Dist. | 2021 | Damages calculation | Remedy determination',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 320,
          originalFormat: 'docx',
          warnings: ['Legal citations preserved'],
          errors: []
        }
      };

      mockParser.parseDocument.mockResolvedValue({
        metadata: { filename: 'motion-summary-judgment.docx', fileSize: 85000 },
        content: [],
        styles: [],
        images: []
      });

      mockContentProcessor.cleanContent.mockResolvedValue(legalBriefContent);

      const options: ProcessingOptions = {
        outputFormat: 'html',
        preserveImages: false,
        includeMetadata: true,
        cleanupLevel: 'minimal', // Preserve legal formatting
        customSettings: {
          preserveCitations: true,
          maintainLegalStructure: true
        }
      };

      const result = await batchProcessor.processFilePaths(['/test/motion-summary-judgment.docx'], options);

      expect(result.successfulFiles).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output?.title).toContain('Motion for Summary Judgment');
      expect(result.results[0].output?.sections).toHaveLength(12);
      expect(result.results[0].output?.metadata.warnings).toContain('Legal citations preserved');

      // Verify legal document structure is maintained
      const sections = result.results[0].output?.sections || [];
      const argumentSection = sections.find(s => s.content.includes('III. ARGUMENT'));
      expect(argumentSection).toBeDefined();
      
      const caseTable = sections.find(s => s.content.includes('Case Law Analysis'));
      expect(caseTable).toBeDefined();
      expect(caseTable?.type).toBe('table');
    });

    it('should handle technical specification document with diagrams', async () => {
      const technicalSpecContent: StructuredContent = {
        title: 'API Technical Specification v2.1',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'API Technical Specification v2.1',
            children: []
          },
          {
            type: 'paragraph',
            content: 'Document Version: 2.1 | Last Updated: January 2025 | Status: Final',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: '1. Overview',
            children: []
          },
          {
            type: 'paragraph',
            content: 'This document specifies the technical requirements and implementation details for the Customer Management API.',
            children: []
          },
          {
            type: 'heading',
            level: 2,
            content: '2. Authentication',
            children: []
          },
          {
            type: 'paragraph',
            content: 'The API uses OAuth 2.0 with JWT tokens for authentication and authorization.',
            children: []
          },
          {
            type: 'table',
            content: 'Authentication Endpoints',
            children: [
              {
                type: 'paragraph',
                content: 'Endpoint | Method | Purpose | Required Parameters',
                children: []
              },
              {
                type: 'paragraph',
                content: '/auth/token | POST | Obtain access token | client_id, client_secret, grant_type',
                children: []
              },
              {
                type: 'paragraph',
                content: '/auth/refresh | POST | Refresh access token | refresh_token',
                children: []
              },
              {
                type: 'paragraph',
                content: '/auth/revoke | POST | Revoke token | token, token_type_hint',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: '3. API Endpoints',
            children: []
          },
          {
            type: 'heading',
            level: 3,
            content: '3.1 Customer Management',
            children: []
          },
          {
            type: 'table',
            content: 'Customer API Endpoints',
            children: [
              {
                type: 'paragraph',
                content: 'Endpoint | Method | Description | Request Body | Response',
                children: []
              },
              {
                type: 'paragraph',
                content: '/customers | GET | List all customers | None | Array of customer objects',
                children: []
              },
              {
                type: 'paragraph',
                content: '/customers/{id} | GET | Get customer by ID | None | Customer object',
                children: []
              },
              {
                type: 'paragraph',
                content: '/customers | POST | Create new customer | Customer object | Created customer with ID',
                children: []
              },
              {
                type: 'paragraph',
                content: '/customers/{id} | PUT | Update customer | Customer object | Updated customer object',
                children: []
              },
              {
                type: 'paragraph',
                content: '/customers/{id} | DELETE | Delete customer | None | Success confirmation',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: '4. Data Models',
            children: []
          },
          {
            type: 'heading',
            level: 3,
            content: '4.1 Customer Object',
            children: []
          },
          {
            type: 'table',
            content: 'Customer Object Schema',
            children: [
              {
                type: 'paragraph',
                content: 'Field | Type | Required | Description | Validation',
                children: []
              },
              {
                type: 'paragraph',
                content: 'id | integer | No | Unique identifier | Auto-generated',
                children: []
              },
              {
                type: 'paragraph',
                content: 'name | string | Yes | Customer name | 1-100 characters',
                children: []
              },
              {
                type: 'paragraph',
                content: 'email | string | Yes | Email address | Valid email format',
                children: []
              },
              {
                type: 'paragraph',
                content: 'phone | string | No | Phone number | E.164 format',
                children: []
              },
              {
                type: 'paragraph',
                content: 'created_at | datetime | No | Creation timestamp | ISO 8601 format',
                children: []
              },
              {
                type: 'paragraph',
                content: 'updated_at | datetime | No | Last update timestamp | ISO 8601 format',
                children: []
              }
            ]
          },
          {
            type: 'heading',
            level: 2,
            content: '5. Error Handling',
            children: []
          },
          {
            type: 'paragraph',
            content: 'The API uses standard HTTP status codes and provides detailed error messages in JSON format.',
            children: []
          },
          {
            type: 'table',
            content: 'HTTP Status Codes',
            children: [
              {
                type: 'paragraph',
                content: 'Code | Status | Description | Example Response',
                children: []
              },
              {
                type: 'paragraph',
                content: '200 | OK | Request successful | {"status": "success", "data": {...}}',
                children: []
              },
              {
                type: 'paragraph',
                content: '400 | Bad Request | Invalid request format | {"error": "Invalid JSON format"}',
                children: []
              },
              {
                type: 'paragraph',
                content: '401 | Unauthorized | Authentication required | {"error": "Access token required"}',
                children: []
              },
              {
                type: 'paragraph',
                content: '404 | Not Found | Resource not found | {"error": "Customer not found"}',
                children: []
              },
              {
                type: 'paragraph',
                content: '500 | Internal Error | Server error | {"error": "Internal server error"}',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 280,
          originalFormat: 'docx',
          warnings: ['Diagram placeholders converted'],
          errors: []
        }
      };

      mockParser.parseDocument.mockResolvedValue({
        metadata: { filename: 'api-specification.docx', fileSize: 120000 },
        content: [],
        styles: [],
        images: []
      });

      mockContentProcessor.cleanContent.mockResolvedValue(technicalSpecContent);

      const options: ProcessingOptions = {
        outputFormat: 'markdown',
        preserveImages: false,
        includeMetadata: true,
        cleanupLevel: 'standard',
        customSettings: {
          preserveCodeBlocks: true,
          maintainTableStructure: true
        }
      };

      const result = await batchProcessor.processFilePaths(['/test/api-specification.docx'], options);

      expect(result.successfulFiles).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output?.title).toBe('API Technical Specification v2.1');
      expect(result.results[0].output?.sections).toHaveLength(16);
      expect(result.results[0].output?.metadata.warnings).toContain('Diagram placeholders converted');

      // Verify technical document structure
      const sections = result.results[0].output?.sections || [];
      const authTable = sections.find(s => s.content.includes('Authentication Endpoints'));
      expect(authTable).toBeDefined();
      expect(authTable?.type).toBe('table');

      const customerEndpoints = sections.find(s => s.content.includes('Customer API Endpoints'));
      expect(customerEndpoints).toBeDefined();
      expect(customerEndpoints?.type).toBe('table');

      const errorCodes = sections.find(s => s.content.includes('HTTP Status Codes'));
      expect(errorCodes).toBeDefined();
      expect(errorCodes?.type).toBe('table');
    });
  });

  describe('Output Format Correctness Verification', () => {
    it('should produce valid HTML that passes basic validation', async () => {
      const testContent: StructuredContent = {
        title: 'HTML Validation Test Document',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'HTML Validation Test Document',
            children: []
          },
          {
            type: 'paragraph',
            content: 'This document tests HTML output validation with special characters: <>&"\'',
            children: []
          },
          {
            type: 'list',
            content: 'Test items:',
            children: [
              {
                type: 'paragraph',
                content: 'Item with <em>emphasis</em> and "quotes"',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Item with & ampersand and > greater than',
                children: []
              }
            ]
          },
          {
            type: 'table',
            content: 'Special Characters Test',
            children: [
              {
                type: 'paragraph',
                content: 'Character | HTML Entity | Description',
                children: []
              },
              {
                type: 'paragraph',
                content: '< | &lt; | Less than',
                children: []
              },
              {
                type: 'paragraph',
                content: '> | &gt; | Greater than',
                children: []
              },
              {
                type: 'paragraph',
                content: '& | &amp; | Ampersand',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 100,
          originalFormat: 'docx',
          warnings: [],
          errors: []
        }
      };

      mockFormatConverter.toHTML.mockReturnValue(
        '<h1>HTML Validation Test Document</h1>\n<p>This document tests HTML output validation with special characters: &lt;&gt;&amp;&quot;&#39;</p>\n<p>Test items:</p>\n<ul>\n<li>Item with &lt;em&gt;emphasis&lt;/em&gt; and &quot;quotes&quot;</li>\n<li>Item with &amp; ampersand and &gt; greater than</li>\n</ul>\n<table>\n<caption>Special Characters Test</caption>\n<tr><th>Character</th><th>HTML Entity</th><th>Description</th></tr>\n<tr><td>&lt;</td><td>&amp;lt;</td><td>Less than</td></tr>\n<tr><td>&gt;</td><td>&amp;gt;</td><td>Greater than</td></tr>\n<tr><td>&amp;</td><td>&amp;amp;</td><td>Ampersand</td></tr>\n</table>'
      );

      const htmlOutput = mockFormatConverter.toHTML(testContent);

      // Verify HTML structure
      expect(htmlOutput).toContain('<h1>HTML Validation Test Document</h1>');
      expect(htmlOutput).toContain('<p>This document tests HTML output validation');
      expect(htmlOutput).toContain('<ul>');
      expect(htmlOutput).toContain('<li>Item with');
      expect(htmlOutput).toContain('<table>');
      expect(htmlOutput).toContain('<caption>Special Characters Test</caption>');
      expect(htmlOutput).toContain('<tr><th>Character</th>');

      // Verify proper HTML entity encoding
      expect(htmlOutput).toContain('&lt;');
      expect(htmlOutput).toContain('&gt;');
      expect(htmlOutput).toContain('&amp;');
      expect(htmlOutput).toContain('&quot;');
      expect(htmlOutput).toContain('&#39;');

      // Verify proper HTML entity encoding (but allow valid HTML tags)
      expect(htmlOutput).toContain('&lt;');
      expect(htmlOutput).toContain('&gt;');
      expect(htmlOutput).toContain('&amp;');
      expect(htmlOutput).toContain('&quot;');
      expect(htmlOutput).toContain('&#39;');
    });

    it('should produce valid Markdown with proper escaping', async () => {
      const testContent: StructuredContent = {
        title: 'Markdown Validation Test',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'Markdown Validation Test',
            children: []
          },
          {
            type: 'paragraph',
            content: 'This tests Markdown with special characters: *emphasis* and _underscores_ and [links]',
            children: []
          },
          {
            type: 'list',
            content: 'Test items:',
            children: [
              {
                type: 'paragraph',
                content: 'Item with *asterisks* and _underscores_',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Item with [square brackets] and (parentheses)',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Item with `backticks` and # hash symbols',
                children: []
              }
            ]
          },
          {
            type: 'table',
            content: 'Markdown Characters',
            children: [
              {
                type: 'paragraph',
                content: 'Character | Purpose | Escape Method',
                children: []
              },
              {
                type: 'paragraph',
                content: '* | Emphasis/Lists | Backslash escape',
                children: []
              },
              {
                type: 'paragraph',
                content: '_ | Emphasis | Backslash escape',
                children: []
              },
              {
                type: 'paragraph',
                content: '# | Headers | Backslash escape',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 90,
          originalFormat: 'docx',
          warnings: [],
          errors: []
        }
      };

      mockFormatConverter.toMarkdown.mockReturnValue(
        '# Markdown Validation Test\n\nThis tests Markdown with special characters: \\*emphasis\\* and \\_underscores\\_ and \\[links\\]\n\nTest items:\n\n- Item with \\*asterisks\\* and \\_underscores\\_\n- Item with \\[square brackets\\] and \\(parentheses\\)\n- Item with \\`backticks\\` and \\# hash symbols\n\n| Character | Purpose | Escape Method |\n|-----------|---------|---------------|\n| \\* | Emphasis/Lists | Backslash escape |\n| \\_ | Emphasis | Backslash escape |\n| \\# | Headers | Backslash escape |'
      );

      const markdownOutput = mockFormatConverter.toMarkdown(testContent);

      // Verify Markdown structure
      expect(markdownOutput).toContain('# Markdown Validation Test');
      expect(markdownOutput).toContain('- Item with');
      expect(markdownOutput).toContain('| Character | Purpose | Escape Method |');
      expect(markdownOutput).toContain('|-----------|---------|---------------|');

      // Verify proper Markdown escaping
      expect(markdownOutput).toContain('\\*emphasis\\*');
      expect(markdownOutput).toContain('\\_underscores\\_');
      expect(markdownOutput).toContain('\\[links\\]');
      expect(markdownOutput).toContain('\\`backticks\\`');
      expect(markdownOutput).toContain('\\# hash symbols');

      // Verify table structure
      expect(markdownOutput).toMatch(/\|.*\|.*\|.*\|/); // Table rows
      expect(markdownOutput).toMatch(/\|-+\|-+\|-+\|/); // Table separator
    });

    it('should produce clean plain text without formatting artifacts', async () => {
      const testContent: StructuredContent = {
        title: 'Plain Text Validation Test',
        sections: [
          {
            type: 'heading',
            level: 1,
            content: 'Plain Text Validation Test',
            children: []
          },
          {
            type: 'paragraph',
            content: 'This document should produce clean plain text without any formatting artifacts or special characters.',
            children: []
          },
          {
            type: 'list',
            content: 'Requirements:',
            children: [
              {
                type: 'paragraph',
                content: 'No HTML tags or entities',
                children: []
              },
              {
                type: 'paragraph',
                content: 'No Markdown formatting symbols',
                children: []
              },
              {
                type: 'paragraph',
                content: 'Clean, readable text structure',
                children: []
              }
            ]
          },
          {
            type: 'table',
            content: 'Text Formatting Test',
            children: [
              {
                type: 'paragraph',
                content: 'Original | Expected | Result',
                children: []
              },
              {
                type: 'paragraph',
                content: '<b>Bold</b> | Bold | Bold',
                children: []
              },
              {
                type: 'paragraph',
                content: '*Emphasis* | Emphasis | Emphasis',
                children: []
              }
            ]
          }
        ],
        metadata: {
          processedAt: new Date(),
          processingTime: 80,
          originalFormat: 'docx',
          warnings: [],
          errors: []
        }
      };

      mockFormatConverter.toPlainText.mockReturnValue(
        'Plain Text Validation Test\n\nThis document should produce clean plain text without any formatting artifacts or special characters.\n\nRequirements:\n• No HTML tags or entities\n• No Markdown formatting symbols\n• Clean, readable text structure\n\nText Formatting Test\nOriginal | Expected | Result\nBold | Bold | Bold\nEmphasis | Emphasis | Emphasis'
      );

      const plainTextOutput = mockFormatConverter.toPlainText(testContent);

      // Verify plain text structure
      expect(plainTextOutput).toContain('Plain Text Validation Test');
      expect(plainTextOutput).toContain('Requirements:');
      expect(plainTextOutput).toContain('• No HTML tags');
      expect(plainTextOutput).toContain('Text Formatting Test');

      // Verify no formatting artifacts
      expect(plainTextOutput).not.toContain('<');
      expect(plainTextOutput).not.toContain('>');
      expect(plainTextOutput).not.toContain('&');
      expect(plainTextOutput).not.toContain('#');
      expect(plainTextOutput).not.toContain('**');
      expect(plainTextOutput).not.toContain('__');
      expect(plainTextOutput).not.toContain('[');
      expect(plainTextOutput).not.toContain(']');
      expect(plainTextOutput).not.toContain('|---');

      // Verify proper text structure
      expect(plainTextOutput).toMatch(/\n\n/); // Paragraph breaks
      expect(plainTextOutput).toMatch(/^[A-Z]/); // Starts with capital
      expect(plainTextOutput).toMatch(/[a-zA-Z]$/); // Ends with letter
    });
  });
});