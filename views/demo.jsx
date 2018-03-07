import React from 'react';
import fetch from 'isomorphic-fetch';
import { JsonLinkInline, Icon } from 'watson-react-components';
import Output from './output.jsx';
import Input from './input.jsx';
import ResetConversationLink from './reset-conversation-link.jsx';
import LanguageSelector from './language-selector.jsx';

// load initial conversation state, a json object
// hack to get around deep clone of initial conversation for reseting conversation
// English
const initialConversationString = JSON.stringify(require('../public/data/initial-conversation'));
const initialConversation = require('../public/data/initial-conversation');
const systemConversation = require('../public/data/initial-tone-analyzer-payload');

// French
const initialConversationFrenchString = JSON.stringify(require('../public/data/initial-conversation-fr'));
const initialConversationFrench = require('../public/data/initial-conversation-fr');
const systemConversationFrench = require('../public/data/initial-tone-analyzer-payload-fr');

const CUSTOMER_NAME = 'Fred';
const CUSTOMER_HANDLE = '@Fred_theConsumer';
const AGENT_NAME = 'Agent';
const AGENT_HANDLE = '@Agent_technology_company';

const MAX_TONES_TO_DISPLAY = 4;
const MAX_LENGTH_USER_UTTERANCE = 500;

const Demo = React.createClass({
  displayName: 'Conversation',

  /**
  * Method to initialize the state of the Conversation react component (ES5 compatible)
  * The initial state for the conversation is stored in a json file - this is a hack
  * as the component won't wait for the response payload from an async call to Tone Analyzer
  * prior to rendering.
  */
  getInitialState() {
    console.log('getInitialState called');
    const initialLastUtterance = initialConversation.utterances[initialConversation.utterances.length - 1];
    // TODO: Change value of initialLastUtterance based on language button pressed

    return {
      conversation: JSON.parse(initialConversationString),
      error: null,
      newUtterancePlaceholder: JSON.parse(initialConversationString).agent.handle,
      newUtteranceAvatarType: initialLastUtterance.user.type === 'agent' ? 'customer_avatar' : 'agent_avatar', // 'customer_avatar'
      showJson: false,
      isResetting: false,
      language: 'en',
      loading: false,
      initializing: true,
      systemConversation,
    };
  },

  componentDidMount() {
    console.log('componentDidMount called');
    fetch('/api/tone_chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(this.state.systemConversation),
    }).then(this.handleErrors).then((response) => {
      response.json().then((tone) => {
        this.setState({
          conversation: this.createConversationJson(tone, 'agent'),
          initializing: false,
        });
      });
    }).catch((error) => {
      this.setState({
        error,
      });
    });
  },

  onShowJson() {
    console.log('onShowJson called');
    this.setState({
      showJson: !this.state.showJson,
    });
  },

  onExitJson() {
    console.log('onExitJson called');
    this.setState({
      showJson: false,
    });
  },

  onSubmit(utterance) {
    console.log('onSubmit called');
    this.setState({
      loading: true,
      error: null,
    });

    // Tone Analyzer tone_chat API endpoint has a max utterance size of 500 characters
    if (utterance.length > MAX_LENGTH_USER_UTTERANCE) {
      this.setState({
        error: {
          message: 'Utterance must be '.concat(MAX_LENGTH_USER_UTTERANCE).concat(' characters or shorter.  Please try again.'),
        },
        loading: false,
      });
    } else {
      fetch('/api/tone_chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          utterances: [
            { text: utterance, user: 'customer' },
          ],
        }),
      }).then(this.handleErrors).then((response) => {
        response.json().then((tone) => {
          this.updateConversation(tone);
          this.setState({
            loading: false,
          });
        });
      }).catch((error) => {
        this.setState({
          error,
          loading: false,
        });
      });
    }
  },

  onVote(utterance, tone, vote) {
    console.log('onVote called');
    const updatedConversation = this.state.conversation;
    const currentUtterance = updatedConversation.utterances.filter(u => u.id === utterance.id);
    const updatedUtteranceVotes = utterance.utterance_votes;
    updatedUtteranceVotes[tone] = vote;
    currentUtterance.utterances_votes = updatedUtteranceVotes;
    this.setState({
      conversation: updatedConversation,
    });

    const voteData = {
      statement: utterance.statement.text,
      user_feedback: {
        tone,
        vote,
      },
      tone_analyzer_payload: utterance.tone_analyzer_payload,
    };

    if (utterance.source === 'user') {
      fetch('/log_perceived_accuracy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(voteData),
      }).then(this.handleErrors).then((response) => {
        console.log('watson tone accuracy logged: '.concat(response));
      }).catch((error) => {
        this.setState({
          error,
        });
      });
    }
  },

  onRecordOtherTone(newToneData) {
    console.log('onRecordOtherTone called');
    fetch('/log_alternative_customer_tones', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(newToneData),
    }).then(this.handleErrors).then((response) => {
      console.log('suggested tone logged: '.concat(response));
    }).catch((error) => {
      this.setState({
        error,
      });
    });
  },

  updateLanguage(language) {
    let updatedSystemConversation = systemConversation;
    let updatedConversation = initialConversationString;
    let updatedInitialConversation = initialConversation;

    console.log('updateLanguage called', language);
    // Do nothing if same language is selected
    if (language === this.state.language) {
      return null;
    }

    if (language === 'fr') {
      updatedSystemConversation = systemConversationFrench;
      updatedConversation = initialConversationFrenchString;
      updatedInitialConversation = initialConversationFrench;
      console.log('CHECK', updatedSystemConversation.utterances);
    }

    this.setState({
      initializing: false,
      conversation: JSON.parse(updatedConversation),
      newUtterancePlaceholder: JSON.parse(updatedConversation).agent.handle,
      newUtteranceAvatarType: updatedInitialConversation.utterances[updatedInitialConversation.utterances.length - 1].user.type === 'agent' ? 'customer_avatar' : 'agent_avatar', // 'customer_avatar'
      systemConversation: updatedSystemConversation,
      language,
    });

    updatedSystemConversation.language = language;

    fetch('/api/tone_chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(updatedSystemConversation),
    }).then(this.handleErrors).then((response) => {
      response.json().then((tone) => {
        this.setState({
          conversation: this.createConversationJson(tone, 'agent'),
          initializing: false,
        });
      });
    }).catch((error) => {
      this.setState({
        error,
      });
    });
  },

  handleErrors(response) {
    if (!response.ok) {
      throw Error(response.statusText);
    }
    return response;
  },

  /*
    utteranceId: id for the utterance for which the conversation turn is created
    customerTonePayloadObject: response payload from the Tone Analyzer tone_chat endpoint
    speaker: one of two strings - 'agent' or 'customer' indicating who made the statement/utterance
    source: one of two strings - 'system' or 'user'.  This is to distinguish between system provided utterances for the conversation initialization
      and utterances provided by the user through the input text box in the UI.
    timestamp: 'now' or (tonesShortlist.length - i).toString().concat(' min ago') for user-generated timestamps
  */
  createConversationTurn(utteranceId, customerTonePayloadObject, speaker, source, timestamp) {
    console.log('createConversationTurn called');
    // sort and map analyzer tones to a json object
    const tonesRaw = customerTonePayloadObject.tones;
    tonesRaw.sort((tone1, tone2) =>
      parseFloat(tone2.score) - parseFloat(tone1.score),
    );
    const sortedTones = tonesRaw.map(t => ({ tone: t.tone_name, score: t.score.toFixed(2) }));
    const tones = sortedTones.slice(0, MAX_TONES_TO_DISPLAY);

    // create new conversation turn object for rendering purposes
    const conversationTurn = {
      utteranceId,
      source,
      user: {
        type: speaker,
        name: speaker === 'agent' ? AGENT_NAME : CUSTOMER_NAME,
        handle: speaker === 'agent' ? AGENT_HANDLE : CUSTOMER_HANDLE,
      },
      statement: {
        text: customerTonePayloadObject.utterance_text,
        timestamp,
      },
      tones,
      tone_analyzer_payload: customerTonePayloadObject,
      utterance_votes: {},
    };

    return conversationTurn;
  },

  /**
  * Create a new conversation object to be added to the conversation state.
  * The toneAnalyzerPayload is parsed and mapped into a format used by the
  * front-end UI.
  */
  updateConversation(toneAnalyzerPayload) {
    console.log('updateConversation called');
    const lastConversationTurn = this.state.conversation.utterances[this.state.conversation.utterances.length - 1];
    const newConversationTurn = this.createConversationTurn(
      lastConversationTurn.id + 1,
      toneAnalyzerPayload.utterances_tone[0],
      lastConversationTurn.user.type === 'agent' ? 'customer' : 'agent',
      'user',
      'now',
    );

    // push new conversation turn to the conversation state and setState
    const conversation = this.state.conversation;
    const newUtteranceAvatarType = newConversationTurn.user.type === 'agent' ? 'customer_avatar' : 'agent_avatar';
    const newUtterancePlaceholder = newConversationTurn.user.type === 'agent' ? this.state.conversation.agent.handle : this.state.conversation.customer.handle;
    conversation.utterances.push(newConversationTurn);
    this.setState({
      conversaton: conversation,
      newUtterancePlaceholder,
      newUtteranceAvatarType,
    });
  },

  createConversationJson(payload, firstTurnType) {
    console.log('createConversationJson called');
    let lastConversationTurnSpeaker = firstTurnType;
    const conversationJson = {
      customer: {
        name: 'Fred',
        handle: '@Fred_theConsumer',
      },
      agent: {
        name: 'Agent',
        handle: '@Agent_technology_company',
      },
      utterances: [],
    };

    const listOfTones = payload.utterances_tone;

    for (let i = 0, len = listOfTones.length; i < len; i += 1) {
      const conversationTurn = this.createConversationTurn(i, payload.utterances_tone[i],
        lastConversationTurnSpeaker === 'agent' ? 'customer' : 'agent',
        'system',
        (listOfTones.length - i).toString().concat(' min ago'),
      );

      conversationJson.utterances.push(conversationTurn);
      lastConversationTurnSpeaker = conversationTurn.user.type;
    }
    return conversationJson;
  },

  resetConversation() {
    console.log('resetConversation called');
    fetch('/api/tone_chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(this.state.systemConversation),
    }).then(this.handleErrors).then((response) => {
      response.json().then((tone) => {
        this.setState({
          conversation: this.createConversationJson(tone, 'agent'),
          error: null,
          newUtterancePlaceholder: JSON.parse(initialConversationString).agent.handle,
          newUtteranceAvatarType: 'customer_avatar',
          isResetting: true,
        });
        setTimeout(() => {
          this.setState({ isResetting: false });
        }, 1);
      });
    }).catch((error) => {
      this.setState({
        error,
      });
    });
    setTimeout(() => {
      this.setState({ isResetting: false });
    }, 1);
  },

  render() {
    return (
      this.state.initializing ?
        (
          <div className="loading_container">
            <Icon type="loader" size="large" />
          </div>) :
          (<div>
            <LanguageSelector
              onLanguageSelection={this.updateLanguage}
            />
            <div>selected language is {this.state.language}</div>
            { this.state.initializing ?
              (
                <div className="loading_container">
                  <Icon type="loader" size="large" />
                </div>) :
                <Output
                  conversation={this.state.conversation.utterances}
                  onVote={this.onVote}
                  onRecordOtherTone={this.onRecordOtherTone}
                  isResetting={this.state.isResetting}
                />
            }
            { this.state.loading ?
              (
                <div className="loading_container">
                  <Icon type="loader" size="large" />
                </div>) :
                <Input
                  error={this.state.error}
                  onSubmit={this.onSubmit}
                  newUtterancePlaceholder={this.state.newUtterancePlaceholder}
                  newUtteranceAvatarType={this.state.newUtteranceAvatarType}
                />
            }
            <div className="conversation_footer">
              <JsonLinkInline
                json={this.state.conversation}
                showJson={this.state.showJson}
                onExit={this.onExitJson}
                onShow={this.onShowJson}
                description={
                  <ResetConversationLink resetConversation={this.resetConversation} />
                }
              />
            </div>
          </div>)
    );
  },

});

export default Demo;
