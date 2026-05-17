import { IssueAnalyzer } from '../src/analyzers/issue';
import { IssueInfo, IssueType, Complexity } from '../src/types';

describe('IssueAnalyzer', () => {
  let analyzer: IssueAnalyzer;

  beforeEach(() => {
    analyzer = new IssueAnalyzer();
  });

  describe('parseIssueUrl', () => {
    it('should parse valid GitHub issue URL', () => {
      const url = 'https://github.com/owner/repo/issues/123';
      const result = (analyzer as any).parseIssueUrl(url);
      
      expect(result).toEqual({
        owner: 'owner',
        repo: 'repo',
        number: 123,
      });
    });

    it('should throw error for invalid URL', () => {
      const url = 'https://invalid-url.com';
      
      expect(() => {
        (analyzer as any).parseIssueUrl(url);
      }).toThrow('Invalid GitHub issue URL');
    });
  });

  describe('detectIssueType', () => {
    it('should detect bug type', () => {
      const title = 'Fix critical bug in authentication';
      const body = 'The login system is broken';
      
      const type = (analyzer as any).detectIssueType(title, body);
      
      expect(type).toBe('bug');
    });

    it('should detect feature type', () => {
      const title = 'Add new dashboard feature';
      const body = 'Implement a new analytics dashboard';
      
      const type = (analyzer as any).detectIssueType(title, body);
      
      expect(type).toBe('feature');
    });

    it('should detect enhancement type', () => {
      const title = 'Improve performance of data loading';
      const body = 'Optimize the data fetching mechanism';
      
      const type = (analyzer as any).detectIssueType(title, body);
      
      expect(type).toBe('enhancement');
    });

    it('should detect documentation type', () => {
      const title = 'Update API documentation';
      const body = 'Add missing documentation for new endpoints';
      
      const type = (analyzer as any).detectIssueType(title, body);
      
      expect(type).toBe('documentation');
    });

    it('should detect refactor type', () => {
      const title = 'Refactor authentication module';
      const body = 'Cleanup and reorganize auth code';
      
      const type = (analyzer as any).detectIssueType(title, body);
      
      expect(type).toBe('refactor');
    });

    it('should default to feature for unknown types', () => {
      const title = 'Some random title';
      const body = 'Some random description';
      
      const type = (analyzer as any).detectIssueType(title, body);
      
      expect(type).toBe('feature');
    });
  });

  describe('assessComplexity', () => {
    it('should assess low complexity', () => {
      const body = 'Simple typo fix in documentation';
      const labels: string[] = [];
      
      const complexity = (analyzer as any).assessComplexity(body, labels);
      
      expect(complexity).toBe('low');
    });

    it('should assess medium complexity', () => {
      const body = 'Update the user profile component to include new fields';
      const labels: string[] = [];
      
      const complexity = (analyzer as any).assessComplexity(body, labels);
      
      expect(complexity).toBe('medium');
    });

    it('should assess high complexity', () => {
      const body = 'Implement new authentication system with database migration and security updates across multiple files';
      const labels: string[] = [];
      
      const complexity = (analyzer as any).assessComplexity(body, labels);
      
      expect(complexity).toBe('high');
    });

    it('should assess critical complexity from labels', () => {
      const body = 'Some issue';
      const labels = ['critical', 'high priority'];
      
      const complexity = (analyzer as any).assessComplexity(body, labels);
      
      expect(complexity).toBe('critical');
    });

    it('should assess low complexity from labels', () => {
      const body = 'Some issue';
      const labels = ['easy', 'good first issue'];
      
      const complexity = (analyzer as any).assessComplexity(body, labels);
      
      expect(complexity).toBe('low');
    });
  });

  describe('extractRequirements', () => {
    it('should extract numbered list requirements', () => {
      const body = `
Requirements:
1. Add user authentication
2. Implement password reset
3. Add email verification
      `;
      
      const requirements = (analyzer as any).extractRequirements(body);
      
      expect(requirements).toContain('Add user authentication');
      expect(requirements).toContain('Implement password reset');
      expect(requirements).toContain('Add email verification');
    });

    it('should extract bullet point requirements', () => {
      const body = `
Requirements:
- Add user authentication
- Implement password reset
- Add email verification
      `;
      
      const requirements = (analyzer as any).extractRequirements(body);
      
      expect(requirements.length).toBeGreaterThan(0);
    });

    it('should extract "should" statements', () => {
      const body = 'The system should validate user input and must handle errors gracefully';
      
      const requirements = (analyzer as any).extractRequirements(body);
      
      expect(requirements.length).toBeGreaterThan(0);
    });
  });

  describe('extractAcceptanceCriteria', () => {
    it('should extract acceptance criteria section', () => {
      const body = `
Acceptance Criteria:
- User can log in successfully
- Password is validated
- Error messages are displayed
      `;
      
      const criteria = (analyzer as any).extractAcceptanceCriteria(body);
      
      expect(criteria).toContain('User can log in successfully');
      expect(criteria).toContain('Password is validated');
      expect(criteria).toContain('Error messages are displayed');
    });

    it('should extract checkboxes', () => {
      const body = `
Tasks:
- [ ] Implement login form
- [ ] Add validation
- [ ] Write tests
      `;
      
      const criteria = (analyzer as any).extractAcceptanceCriteria(body);
      
      expect(criteria).toContain('Implement login form');
      expect(criteria).toContain('Add validation');
      expect(criteria).toContain('Write tests');
    });
  });

  describe('extractRelatedIssues', () => {
    it('should extract issue references', () => {
      const body = 'Related to #123 and #456';
      
      const issues = (analyzer as any).extractRelatedIssues(body);
      
      expect(issues).toContain(123);
      expect(issues).toContain(456);
    });

    it('should extract full GitHub URLs', () => {
      const body = 'See https://github.com/owner/repo/issues/789';
      
      const issues = (analyzer as any).extractRelatedIssues(body);
      
      expect(issues).toContain(789);
    });

    it('should remove duplicates', () => {
      const body = 'Related to #123, #123, and #123';
      
      const issues = (analyzer as any).extractRelatedIssues(body);
      
      expect(issues).toEqual([123]);
    });
  });

  describe('identifyAffectedComponents', () => {
    it('should identify file paths', () => {
      const body = 'Changes needed in src/components/Button.tsx and src/utils/helpers.ts';
      
      const components = (analyzer as any).identifyAffectedComponents(body);
      
      expect(components).toContain('src/components/Button.tsx');
      expect(components).toContain('src/utils/helpers.ts');
    });

    it('should identify component mentions', () => {
      const body = 'Component: `UserProfile` needs to be updated';
      
      const components = (analyzer as any).identifyAffectedComponents(body);
      
      expect(components).toContain('UserProfile');
    });
  });

  describe('generateSummary', () => {
    it('should generate complete summary', () => {
      const issue: IssueInfo = {
        url: 'https://github.com/owner/repo/issues/123',
        number: 123,
        title: 'Add user authentication',
        description: 'Implement user login and registration',
        type: 'feature',
        complexity: 'medium',
        affectedComponents: ['src/auth/login.ts'],
        requirements: ['Add login form', 'Implement validation'],
        acceptanceCriteria: ['User can log in', 'Errors are handled'],
        relatedIssues: [122],
      };
      
      const summary = analyzer.generateSummary(issue);
      
      expect(summary).toContain('Issue #123');
      expect(summary).toContain('Add user authentication');
      expect(summary).toContain('Type: feature');
      expect(summary).toContain('Complexity: medium');
      expect(summary).toContain('Affected Components:');
      expect(summary).toContain('Requirements:');
      expect(summary).toContain('Acceptance Criteria:');
      expect(summary).toContain('Related Issues:');
    });
  });
});
