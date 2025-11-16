/**
 * IssuesList Component
 * Displays a list of issues and violations from verification results
 */

export class IssuesList {
    /**
     * Create an issues list element
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Array<string>} issues - Array of issue messages
     * @returns {HTMLElement} Issues list element
     */
    static create(domRegistry, issues) {
        const issuesList = domRegistry.createElement('ul');
        issuesList.className = 'issues-list';
        
        if (!issues || issues.length === 0) {
            const noIssues = domRegistry.createElement('li');
            noIssues.className = 'issue-item issue-none';
            noIssues.textContent = 'No issues found';
            issuesList.appendChild(noIssues);
        } else {
            issues.forEach(issue => {
                const issueItem = domRegistry.createElement('li');
                issueItem.className = 'issue-item';
                issueItem.textContent = issue;
                issuesList.appendChild(issueItem);
            });
        }
        
        return issuesList;
    }

    /**
     * Create issues list from verification result
     * Combines issues from soundness and boundedness
     * @param {Object} domRegistry - DOM registry for creating elements
     * @param {Object} verificationResult - Verification result object
     * @returns {HTMLElement} Issues list element
     */
    static createFromVerificationResult(domRegistry, verificationResult) {
        const allIssues = [
            ...(verificationResult.soundness?.issues || []),
            ...(verificationResult.boundedness?.issues || [])
        ];
        
        return this.create(domRegistry, allIssues);
    }
}

