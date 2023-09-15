import { LOGIN_TIMEOUT, ACS_LOGIN_SUCCESS_MESSAGE } from './constants.js';

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

        cy.get(`[id=user-${i}]`)
            .find('[id=acs-login-success-message]', { timeout: LOGIN_TIMEOUT })
            .should('contain', ACS_LOGIN_SUCCESS_MESSAGE);

        cy.get(`[id=user-${i}]`)
            .find('[id=acs-identity]')
            .invoke('text')
            .then(text => {
                ids.push(text)
                if (i == numberOfUsers - 1) {
                    cy.wrap(ids).as('ids');
                }
            });
    }
}