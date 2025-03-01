import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";


const client = new DynamoDBClient({ region: "us-west-2" }); // Set your AWS region
const dynamoDB = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "RealEstateBotUserData";

export  async function handler(event) {
  console.log("🔹 Lex Event Received:", JSON.stringify(event, null, 2));

  const sessionId = event.sessionId || 'default-session';
  const  intentName = event.sessionState.intent.name;
  const invocationSource = event.invocationSource;
  let slots = event.sessionState.intent.slots || {};
  let sessionAttributes = event.sessionState.sessionAttributes || {};

  // ✅ Extract the confidence score of the detected intent
  const interpretations = event.interpretations || [];

  let topIntent = interpretations[0] ? interpretations[0].intent : null;
  let topInterpretation = interpretations[0] || {};
  let confidenceScore = topInterpretation.nluConfidence ?? -1;
  const confidenceThreshold = 0.1;
  console.log(`🟢 Full Interpretations: ${JSON.stringify(event.interpretations, null, 2)}`);
  console.log(`🟢 Intent: ${topIntent.name}, Confidence Score: ${confidenceScore}`);

  if(intentName === 'PurposeofContactBuyOrSell'){
    return handlePurposeofContactBuyOrSell(event,confidenceThreshold)
  } else if(intentName === 'ContactToReach'){
    return handleContactToReach(event)
  }else{
    return handleFallbackIntent(event)
  }
}

async function handlePurposeofContactBuyOrSell(event,confidenceThreshold){
    const sessionId = event.sessionId || 'default-session';
    const  intentName = event.sessionState.intent.name;
    const invocationSource = event.invocationSource;
    let slots = event.sessionState.intent.slots || {};
    let sessionAttributes = event.sessionState.sessionAttributes || {};
  
    // ✅ Extract the confidence score of the detected intent
    const interpretations = event.interpretations || [];
  
    let topIntent = interpretations[0] ? interpretations[0].intent : null;
    let topInterpretation = interpretations[0] || {};
    let confidenceScore = topInterpretation.nluConfidence ?? -1;



  // ✅ Handle low confidence cases 
  if (confidenceScore < confidenceThreshold) {
      console.log("⚠️ Low confidence detected. Triggering clarification.");
      return {
          "sessionState": {
              "dialogAction": { "type": "ElicitIntent" },
              "sessionAttributes": sessionAttributes
          },
          "messages": [
              { "contentType": "PlainText", "content": "Sorry, I didn't understand that. Can you please rephrase? Are you looking to Buy or Sell a property?" }
          ]
      };
  }

  // ✅ Handle Slot Elicitation (Display Response Card)
  console.log("📌 Stage: Slot Elicitation");

  let purposeVal = slots['purpose']?.value?.interpretedValue || null;

  if (!purposeVal) {
      console.log("⚠️ Slot 'purpose' is empty. Asking user for input.");
      //return elicitSlotWithCardResponse(sessionId, intentName, slots, "purpose", "Please select Buy, Sell, or Other.", sessionAttributes);
      //return elicitSlotWithInteractiveMessage(sessionId, intentName, slots, "purpose", "Please select Buy, Sell, or Other.", sessionAttributes)
      return elicitSlotWithPlainTextMessage(sessionId, intentName, slots, "purpose", "Please select Buy, Sell, or Other.", sessionAttributes);
    }

  // ✅ Handle Intent Confirmation
  if (event.sessionState.intent.confirmationState === 'None') {
      console.log("📌 Stage: Intent Confirmation");
      sessionAttributes['IntentPurposeofContactBuyOrSell'] = true;
      return confirmationIntentResponse(sessionId, intentName, slots, `You selected ${purposeVal}. Do you confirm? `, sessionAttributes);
  }

  // ✅ Handle Fulfillment (Final Response)
  if (event.sessionState.intent.confirmationState === 'Confirmed') {
       sessionAttributes['IntentPurposeofContactBuyOrSell'] = true;
      console.log("📌 Stage: Fulfillment");
      //Save the information on database
      await saveUserData(sessionId, purposeVal, null);
      return delegateIntent(sessionId,intentName, slots, `Thank you! We can proceed with your request: ${purposeVal}, An agent will connect you for further details. Please do provide us the best number to reach`, sessionAttributes);
  }

  // ✅ Default Fallback Intent Handling
  console.log("📌 Stage: Default Response (Unexpected)");
  return closeIntent(sessionId,intentName, slots, "Something went wrong. Please try again.", sessionAttributes);
}


async function handleContactToReach(event){
    const sessionId = event.sessionId || 'default-session';
    const  intentName = event.sessionState.intent.name;
    const invocationSource = event.invocationSource;
    let slots = event.sessionState.intent.slots || {};
    let sessionAttributes = event.sessionState.sessionAttributes || {};
  
    // ✅ Extract the confidence score of the detected intent
    const interpretations = event.interpretations || [];
    let topIntent = interpretations[0] ? interpretations[0].intent : null;
    let topInterpretation = interpretations[0] || {};
    let confidenceScore = topInterpretation.nluConfidence ?? -1;

// ✅ ContactToReach Intent Handling
    console.log("📌 Stage: handleContactToReach Response ");
// Do not handle the phone number till we understand the nature of the service based on purpose slot
    if(sessionAttributes['IntentPurposeofContactBuyOrSell'] !== "true"){
        return {
            "sessionState": {
                "dialogAction": { "type": "ElicitIntent" },
                "sessionAttributes": sessionAttributes
            },
            "messages": [
                { "contentType": "PlainText", "content": "Sorry, I didn't understand that. Can you please rephrase? Are you looking to Buy or Sell a property?" }
            ]
        };
    }

    let phoneNoVal = slots['phoneno']?.value?.interpretedValue || null;
    // ✅ Manually extract from inputTranscript if Lex didn't fill it
    if (!phoneNoVal && event.inputTranscript) {
        phoneNoVal = event.inputTranscript;
        console.log(`✅ Manually extracted phoneno: ${phoneNoVal}`);
        // ✅ Assign it to the slot manually
        slots["phoneno"] = { value: { interpretedValue: phoneNoVal } };
    }
    if(!phoneNoVal || (sessionAttributes['IntentPurposeofContactBuyOrSell'] !== "true")){
        return {
            "sessionState": {
                "dialogAction": { "type": "ElicitIntent" },
                "sessionAttributes": sessionAttributes
            },
            "messages": [
                { "contentType": "PlainText", "content": "Sorry, I didn't understand that. Can you please provide a best number to reach" }
            ]
        };
    }

    // ✅ Handle phone Intent Confirmation
  if (event.sessionState.intent.confirmationState === 'None') {
    console.log("📌 Stage: Intent Confirmation");
    return confirmationIntentResponse(sessionId, intentName, slots, `You selected ${phoneNoVal}. to contact you . Do you confirm?`, sessionAttributes);
  }
  // ✅ Handle Fulfillment (Final Response)
  if (event.sessionState.intent.confirmationState === 'Confirmed') {
    sessionAttributes['IntentContactToReach'] = true;
   console.log("📌 Stage: Fulfillment");
   //Save the data Dynomodb db
   await saveUserData(sessionId, sessionAttributes["purpose"], phoneNoVal);
   return closeIntent(sessionId,intentName, slots, `Thank you!  An agent will call on provided phone : ${phoneNoVal} Shortly`, sessionAttributes);
}

  // ✅ Default Fallback Intent Handling
  console.log("📌 Stage: Default Response (Unexpected)");
  return closeIntent(sessionId,intentName, slots, "Something went wrong. Please try again.", sessionAttributes);
}

function handleFallbackIntent(event){
    const sessionId = event.sessionId || 'default-session';
    const  intentName = event.sessionState.intent.name;
    const invocationSource = event.invocationSource;
    let slots = event.sessionState.intent.slots || {};
    let sessionAttributes = event.sessionState.sessionAttributes || {};
  
    // ✅ Extract the confidence score of the detected intent
    const interpretations = event.interpretations || [];
  
    let topIntent = interpretations[0] ? interpretations[0].intent : null;
    let topInterpretation = interpretations[0] || {};
    let confidenceScore = topInterpretation.nluConfidence ?? -1;
// ✅ Default Fallback Intent Handling
console.log("📌 Stage: Default Response (Unexpected)");
return closeIntent(sessionId,intentName, slots, "Something went wrong. Please try again.", sessionAttributes);
}

/** 🛠️ Helper Function: Elicit Slot with Plain Text Message */
function elicitSlotWithPlainTextMessage(sessionId, intentName, slots, slotToElicit, message, sessionAttributes) {
    console.log(`🔹 Eliciting Slot: ${slotToElicit} with Plain Text Message`);
  
    return {
        "sessionState": {
            "sessionAttributes": sessionAttributes,
            "intent": { "name": intentName, "slots": slots },
            "dialogAction": { "type": "ElicitSlot", "slotToElicit": slotToElicit }
        },
        "messages": [
            { "contentType": "PlainText", "content": message }
        ]
    };
  }
  


/** 🛠️ Helper Function: Confirm Intent */
function confirmationIntentResponse(sessionId, intentName, slots, message, sessionAttributes) {
  console.log("🔹 Asking for Confirmation");

  return {
      "sessionState": {
          "sessionAttributes": sessionAttributes,
          "intent": { "name": intentName, "slots": slots },
          "dialogAction": { "type": "ConfirmIntent" }
      },
      "messages": [{ "contentType": "PlainText", "content": message }],
      "dialogAction": { "type": "ConfirmIntent" }
  };
}

/** 🛠️ Helper Function: delegate Intent */
function delegateIntent(sessionId,intentName, slots, message, sessionAttributes) {
  console.log("🔹 delegate Intent with Fulfillment");

  return {
      "sessionState": {
          "sessionAttributes": sessionAttributes,
          "intent": { "name": intentName, "slots": slots , "state": "Fulfilled" },
          "dialogAction": { "type": "Delegate", "fulfillmentState": "Fulfilled" }
      },
      "messages": [{ "contentType": "PlainText", "content": message }],
      "dialogAction": { "type": "Delegate", "fulfillmentState": "Fulfilled" }
  };
}

/** 🛠️ Helper Function: Close Intent */
function closeIntent(sessionId,intentName, slots, message, sessionAttributes) {
    console.log("🔹 Closing Intent with Fulfillment");
  
    return {
        "sessionState": {
            "sessionAttributes": sessionAttributes,
            "intent": { "name": intentName, "slots": slots , "state": "Fulfilled" },
            "dialogAction": { "type": "Close", "fulfillmentState": "Fulfilled" }
        },
        "messages": [{ "contentType": "PlainText", "content": message }],
        "dialogAction": { "type": "Close", "fulfillmentState": "Fulfilled" }
    };
  }

/

async function saveUserData(sessionid, purpose, phoneno) {
    if (!sessionid) {
        console.error("❌ Error: sessionid is undefined.");
        return;
    }

    console.log(`🟢 Updating/Inserting DynamoDB for sessionid: ${sessionid}`);

    let updateExpression = "SET ";
    let expressionAttributeValues = {};

    if (purpose) {
        updateExpression += "purpose = :purpose, ";
        expressionAttributeValues[":purpose"] = purpose;
    }

    if (phoneno) {
        updateExpression += "phoneno = :phoneno, ";
        expressionAttributeValues[":phoneno"] = phoneno;
    }

    updateExpression = updateExpression.slice(0, -2); // Remove last comma

    if (Object.keys(expressionAttributeValues).length === 0) {
        console.log("⚠️ No attributes to update.");
        return;
    }

    const params = {
        TableName: TABLE_NAME,
        Key: { sessionid },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "attribute_exists(sessionid) OR attribute_not_exists(sessionid)"
    };

    try {
        await dynamoDB.send(new UpdateCommand(params));
        console.log(`✅ Successfully inserted/updated in DynamoDB: ${JSON.stringify(params)}`);
    } catch (error) {
        console.error(`❌ Error updating/inserting DynamoDB: ${error.message}`);
    }
}

