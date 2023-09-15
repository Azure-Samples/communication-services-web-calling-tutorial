export function loginUsers(numberOfUsers) {
    const ids = [];
    for (let i = 0; i < numberOfUsers - 1; i++) {
        cy.get('[id=acs-icon]')
        .click();
    }

    for (let i = 0; i < numberOfUsers; i++) {
        cy.get(`[id=user-${i}]`)
            .find('[id=login-button]')
            .click();
        cy.wait(15000);

        cy.get(`[id=user-${i}]`)
            .find('[id=acs-login-success-message]')
            .should('contain', 'Congrats! You\'ve provisioned an ACS user identity');

        cy.get(`[id=user-${i}]`)
            .find('[id=acs-login-success-message]')
            .should('contain', 'Congrats! You\'ve provisioned an ACS user identity');

        cy.get(`[id=user-${i}]`)
            .find('[id=acs-identity]')
            .should(($span) => {
                const text = $span.text()
                expect(text).to.contain('8:acs:');
        })
    }
}