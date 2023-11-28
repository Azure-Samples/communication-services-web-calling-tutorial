# ACS Calling + AI 

CommunicationAI exposes ACS client calling scenarios and AI based enhancements.

Scenarios:
1. Sentiment analysis
2. Conversation summary
4. Personal Feedback
3. Agent Assist


## Prerequisites
Setup a backend webservice to act as a gateway service to OpenAI. 
A sample backend webservice code https://github.com/ACS-SampleProjects/OpenAIGateway
The conversation captured from gathered captions is sent to the backend for AI

## UI
In the front end, turn on captions, toggle AI and select an AI enhancement. See the AI response on the UI.


## Prompts
Sample AI prompts

       // Prompts for call summary generation
       getBriefSummarySystemPrompt = "You are an AI assist, listening to the conversation between the support agent and the user.";
       getBriefSummaryUserPrompt = "From the conversation generate a brief summary of the discussion that can be sent to the support agent supervisor to get context on the conversation so far.";

        
        // Prompts for call insight and sentiment analysis generation 
        getsentimentScoreSystemPrompt = "You are an AI assistant listening to the conversation between the Xbox support agent and the user.";
        getSentimentScoreUserPrompt = @"From the above conversation between the Xbox agent and the user,
                        Generate a sentiment score Positive, Negative or Neutral, based on the conversation, customer satisfaction, and agent ability to support the user.
                        Geneate a call insight. 

                        The response should be a JSON format.
                            {
                                ""callSentiment"": """",
                                ""callInsight"": """"
                            }";

        // Prompt for getting personal feedback
        getPersonalFeedback = "The assistant's role is to provide personal feedback for the active user. Please analyze their language and grammar and phrasing and suggest ways to speak better.",


        // Prompt for xBoxAgentSupport
        getXBoxAgentSupportUserPrompt = @"From the above conversation between the Xbox agent and the user,
                        Extract user content and fill in the requirements form data
                        If the user-provided content is incomplete, stuttered, or unclear, suggest the Xbox support agent with polite suggestions to clarify what was understood and what the agent should ask to fulfill the questions. 
                        The goal is the make sure the user details and issues are well understood and the required details are collected on the form.
                        If the date or mailing address is not valid, suggest agent to get the details from the user.
                        If the purchase date is older than 2 years from the current date, then mark product_under_warranty form data as false.
                        Suggest an agent with Xbox troubleshooting suggestions.
                        The response should be a JSON format.
                     
                                {
                                  ""requirements"": {
                                   ""name_provided"": true/fale,
                                    ""mailing_address_provided"": true/false,
                                    ""date_of_purchase_provided"": true/false,
                                    ""phone_number_provided"": true/false,
                                    ""issue_outlined"": true/false
                                  },
                                  ""form_data"": {
                                    ""name"": ""..."",
                                    ""address"": ""..."",
                                    ""phone_number"": ""..."",
                                    ""date_of_purchase"": ""dd/mm/yyyy"",
                                    ""issue_description"": ""..."",
                                   ""product_under_warranty"":"""",
                                   ""issue_resolved_oncall"": """",
                                   ""support_ticket_number"": """"
                                  },
                                  ""suggested_reply"": ""..."",
                                } ";
         getXBoxAgentSupportSystemPrompt = "You are an AI assistant assisting an Xbox support agent, listening to the conversation between the Xbox support agent and the user.";