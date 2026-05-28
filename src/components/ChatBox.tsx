import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import Draggable from 'react-draggable';
import './comp_css/ChatBox.css';
import { X, Minus, MessageSquare, Maximize2, Minimize2} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// SQL + GATEWAY services
import { UserChannelReadStatusService } from '../generated/services/UserChannelReadStatusService';
import { ChatMessagesService } from '../generated/services/ChatMessagesService';
import { type ChatMessages } from '../generated/models/ChatMessagesModel';

// Custom Utilities
import { ewulFetchAll, ISOtoInt } from '../utils/Ewul_GSDC_Utils';
import {type UserInfo, DEVBOT_USERID, ITDEV_USERID, GSDC_SEND_TO_CHAT_key, GSDC_NAVIGATE_TO_TRIP_key} from '../truth.config';
import { type UserChannelReadStatus } from '../generated/models/UserChannelReadStatusModel';

type MessageWithStatus = Partial<ChatMessages> & { SentAtAsInt?: number; status?: 'sending' | 'sent' | 'failed' };

export interface ChatBoxHandle {
  fetchTotalUnread: () => Promise<number>;
  sendMessage: (text: string, channel?: string) => Promise<void>;
}

interface ChatBoxProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  user: UserInfo | null;
}

const CHANNELS = [
    'Dev Bot',
    'Dispatch',
    'Monitoring',
    'Fuel',
    'Documents',
    'IT Support'
];

const ChatBox = forwardRef<ChatBoxHandle, ChatBoxProps>(({ isOpen, onClose, onOpen, user }, ref) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeChannel, setActiveChannel] = useState('Dispatch');
  const [channelMessages, setChannelMessages] = useState<Record<string, MessageWithStatus[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const nodeRef = useRef(null);
  const minimizedNodeRef = useRef(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  const [isMaximized, setIsMaximized] = useState(false);

  const hasUnreadMessages = Object.values(unreadCounts).some(count => count > 0);

  const fetchUnreadCounts = async () => {
      if (!user) return { counts: {}, total: 0 };

      try {
          // 1. Get user's last read status for all channels
          const readStatuses = await ewulFetchAll<UserChannelReadStatus>(
              UserChannelReadStatusService,
              { filter: `UserID eq '${user.id}'` },
              CHANNELS.length,
              'UserChannelReadStatusID'
          );
          const readStatusMap = new Map(readStatuses.map(s => [s.Channel, s.LastReadMessageID]));

          // 2. For each channel, count messages newer than the last read message
          let total = 0;
          const counts: Record<string, number> = {};
          for (const channel of CHANNELS) {
              const lastReadId = readStatusMap.get(channel) || 0;
              
              let filter = `Channel eq '${channel}' and MessageID gt ${lastReadId} and UserID ne '${user.id}'`;

              if (channel === 'Dev Bot') {
                  // For Dev Bot, only count messages sent specifically TO the current user
                  filter += ` and RecipientUserID eq '${user.id}'`;
              } else {
                  // For public channels, only count public messages
                  filter += ` and RecipientUserID eq null`;
              }

              const unreadMessages = await ewulFetchAll<ChatMessages>(
                  ChatMessagesService,
                  { 
                      filter: filter,
                      select: ['MessageID'], // Only fetch IDs to be lightweight
                      top: 100 // Cap at 100 to represent "99+"
                  },
                  100, // Cap at 100 to represent "99+"
                  'MessageID'
              );
              counts[channel] = unreadMessages.length;
              total += unreadMessages.length;
          }
          return { counts, total };

      } catch (error) {
          console.error("Failed to fetch unread counts:", error);
          return { counts: {}, total: 0 };
      }
  };

    const internalSend = async (text: string, channel: string) => {
        console.log("Received event for Sending chat internally...")
        if (!text.trim() || !user) return;

        const payload = {
            Channel: channel,
            UserID: user.id,
            UserName: user.FullName || user.FirstName,
            MessageText: text,
            SentAt: new Date().toISOString(),
            SentAtAsInt: Number(ISOtoInt(new Date().toISOString(), true)),
            RecipientUserID: channel === 'Dev Bot' ? DEVBOT_USERID : undefined,
        };

        setChannelMessages(prev => ({
            ...prev,
            [channel]: [...(prev[channel] || []), payload]
        }));

        try {
            await ChatMessagesService.create(payload);

            if (activeChannel !== channel) {
                handleChannelClick(channel); // This reuses your existing logic to update read status and switch
            }

            if (!isOpen) {
                onOpen(); 
            }

        } catch (error) {
            console.error("External send failed:", error);
            setChannelMessages(prev => ({
                ...prev,
                [channel]: prev[channel].map(msg => 
                    msg.SentAtAsInt === payload.SentAtAsInt ? { ...msg, status: 'failed' } : msg
                )
            }));
        }
    };

  useImperativeHandle(ref, () => ({
    fetchTotalUnread: async () => {
      const { total } = await fetchUnreadCounts();
      return total;
    },
    sendMessage: async (text: string, channel: string = activeChannel) => {
        await internalSend(text, channel);
    }
  }));

  useEffect(() => {
        const handleExternalSend = (event: any) => {
            const { text, channel } = event.detail;
            internalSend(text, channel || activeChannel);
        };

        window.addEventListener(GSDC_SEND_TO_CHAT_key, handleExternalSend);
        return () => window.removeEventListener(GSDC_SEND_TO_CHAT_key, handleExternalSend);
    }, [activeChannel, user]);

    const renderMessageText = (text: string, onMentionClick: (oe: string) => void, isMine: boolean) => {
        // Combined regex to catch both patterns
        // Group 1: TRIP, Group 2: THINK
        const combinedRegex = /\[TRIP:(.*?)\]|\[THINK:(.*?)\]/g;
        
        const parts = text.split(combinedRegex);
        if (parts.length === 1) return <ReactMarkdown components={{ p: 'span' }}>{text}</ReactMarkdown>;

        // Filter out undefined/empty matches from the split groups
        return parts.map((part, index) => {
            if (!part) return null;

            // Note: With two capture groups, every match consumes 3 array slots (part, group1, group2)
            // However, a simpler way is to check the text content or context
            
            // Handle Trip Mentions
            if (text.includes(`[TRIP:${part}]`)) {
                return (
                    <span 
                        key={index} 
                        className={`chat-mention-trip ${isMine ? 'mine' : ''}`}
                        onClick={() => onMentionClick(part)}
                    >
                        @{part}
                    </span>
                );
            }

            // Handle Thinking Animations
            if (text.includes(`[THINK:${part}]`)) {
                return (
                    <span key={index} className="bot-thinking-text">
                        {/* <span className="thinking-icon"><Settings/></span> */}
                        <div className="chat-loader"></div>
                        {/* {part} */}
                        {/* <span className="dot-one">.</span>
                        <span className="dot-two">.</span>
                        <span className="dot-three">.</span> */}
                    </span>
                );
            }

            return <span key={index}>{part}</span>;
        });
    };



  const updateReadStatus = async (channel: string) => {
    if (!user) return;

    try {
        // Get the latest message in the channel
        const latestMessages = await ewulFetchAll<ChatMessages>(
            ChatMessagesService,
            { filter: `Channel eq '${channel}'`, orderBy: ["MessageID desc"], top: 1 },
            1,
            'MessageID'
        );

        if (latestMessages.length > 0) {
            const lastMessageID = latestMessages[0].MessageID!;
            
            // Check if a read status already exists for this user and channel
            const existingStatus = await ewulFetchAll<UserChannelReadStatus>(
                UserChannelReadStatusService,
                { filter: `UserID eq '${user.id}' and Channel eq '${channel}'`},
                1,
                'UserID' // Assuming UserID+Channel is unique, but need a key
            );

            const payload = {
                UserID: user.id,
                Channel: channel,
                LastReadMessageID: lastMessageID,
                LastReadAt: new Date().toISOString()
            };

            if (existingStatus.length > 0) {
                // Update existing status
                await UserChannelReadStatusService.update(existingStatus[0].UserChannelReadStatusID!.toString(), payload);
            } else {
                // Create new status
                await UserChannelReadStatusService.create(payload);
            }
            
            // Optimistically set unread count for this channel to 0
            setUnreadCounts(prev => ({ ...prev, [channel]: 0 }));
        }
    } catch (error) {
        console.error(`Failed to update read status for ${channel}:`, error);
    }
  };

  const handleChannelClick = (channel: string) => {
      if (activeChannel !== channel) {
          // Optimistically clear the count for the channel we are leaving
          setUnreadCounts(prev => ({ ...prev, [activeChannel]: 0 }));
          
          // Update statuses for both channels in the background
          updateReadStatus(activeChannel); // Mark the old channel as read
          updateReadStatus(channel);       // Mark the new channel as read
      }
      // Switch to the new channel
      setActiveChannel(channel);
  };

  useEffect(() => {
    const pollUnreadCounts = async () => {
        const { counts } = await fetchUnreadCounts();
        setUnreadCounts(counts);
    };
    setUnreadCounts(prev => ({ ...prev, ['Dispatch']: 0 }));
    
    if (isOpen) {
        pollUnreadCounts();
        const interval = setInterval(pollUnreadCounts, 60000); // Poll for unread counts every 60s
        return () => clearInterval(interval);
    }
  }, [isOpen, user]);

    useEffect(() => {
        const fetchInitialMessages = async () => {
            if (!user) return;
            //setMessages([]); // Clear messages for new channel
            setIsLoading(true);

            if (channelMessages[activeChannel] && channelMessages[activeChannel].length > 0) {
                setIsLoading(false);
                return;
            }

            let filter = `Channel eq '${activeChannel}'`;
            if (activeChannel === 'Dev Bot') {
                // For Dev Bot, it's a 1-on-1 chat
                filter += ` and ((UserID eq '${user.id}' and RecipientUserID eq '${DEVBOT_USERID}') or (UserID eq '${DEVBOT_USERID}' and RecipientUserID eq '${user.id}'))`;
            } else {
                // For public channels, only show messages with no recipient
                filter += ` and RecipientUserID eq null`;
            }

            try {
                const fetchedMessages = await ewulFetchAll<ChatMessages>(
                    ChatMessagesService,
                    { 
                        filter: filter, 
                        orderBy: ["SentAt desc"],
                        top: 50
                    },
                    50, // Fetch last 50 messages initially
                    'MessageID'
                );
                const sortedMessages = fetchedMessages.sort((a, b) => new Date(a.SentAt).getTime() - new Date(b.SentAt).getTime());
                //setMessages(sortedMessages.map(m => ({ ...m, status: 'sent' })));
                setChannelMessages(prev => ({
                    ...prev,
                    [activeChannel]: sortedMessages.map(m => ({ ...m, status: 'sent' }))
                }));
            } catch (error) {
                console.error("Failed to fetch initial messages:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchInitialMessages();
        }
    }, [activeChannel, isOpen]);


    useEffect(() => {
        const scrollToBottom = () => {
            if (chatBodyRef.current) {
                chatBodyRef.current.scrollTo({
                top: chatBodyRef.current.scrollHeight,
                behavior: 'smooth'
                });
            }
        };

        scrollToBottom();
    }, [channelMessages, activeChannel, isOpen]);

    useEffect(() => {
        const pollNewMessages = async () => {
            const currentMessages = channelMessages[activeChannel] || [];
            if (!user || currentMessages.length === 0) return;

            // Get the latest message for the active channel
            const lastMessage = currentMessages[currentMessages.length - 1];
            const lastSentAtAsInt = lastMessage.SentAtAsInt;
            if (!lastSentAtAsInt) return;

            let filter = `Channel eq '${activeChannel}' and SentAtAsInt gt ${lastSentAtAsInt}`;
            if (activeChannel === 'Dev Bot') {
                filter += ` and ((UserID eq '${user.id}' and RecipientUserID eq '${DEVBOT_USERID}') or (UserID eq '${DEVBOT_USERID}' and RecipientUserID eq '${user.id}'))`;
            } else if (activeChannel === 'IT Support') {
                filter += ` and ((UserID eq '${user.id}' and RecipientUserID eq '${ITDEV_USERID}') or (UserID eq '${ITDEV_USERID}' and RecipientUserID eq '${user.id}'))`;
            } else {
                filter += ` and RecipientUserID eq null`;
            }

            try {
                const newMessages = await ewulFetchAll<ChatMessages>(
                    ChatMessagesService,
                    {
                        filter: filter,
                        orderBy: ["SentAt asc"],
                        top: 100,
                    },
                    100,
                    'MessageID'
                );

                if (newMessages.length > 0) {
                    const newMessagesWithStatus: MessageWithStatus[] = newMessages.map(m => ({ ...m, status: 'sent' }));
                    setChannelMessages(prev => ({
                        ...prev,
                        [activeChannel]: [...currentMessages, ...newMessagesWithStatus]
                    }));
                }
            } catch (error) {
                console.error("Failed to poll for new messages:", error);
            }
        };

        if (!isOpen) return;

        const intervalId = setInterval(pollNewMessages, 60000); // Poll every 60 seconds
        return () => clearInterval(intervalId);
    }, [channelMessages, activeChannel, isOpen, user]);

    //if (!isOpen) return null;

    const THINKING_PHRASES = [
        // --- General/Professional ---
        "Dev Bot is thinking",
        "Processing your request",
        "Gathering information",
        "Formulating a response",
        "Reviewing system context",

        // --- Logistics & Fleet Focused (GSDC Vibe) ---
        "Analyzing dispatch logs",
        "Scanning fleet manifests",
        "Consulting the GSDC knowledge base",
        "Calculating route efficiencies",
        "Checking driver availability",
        "Cross-referencing logistics data",

        // --- A bit of Personality ---
        "One moment, almost there",
        "Just a second, double-checking the math",
        "Organizing my thoughts",
        "Syncing with the server",
        "Checking the dashboard for updates"
    ];

    const handleSendMessage = async () => {
        if (newMessage.trim() === '' || !user) return;

        const userMsgText = newMessage;
        const optimisticMessage: MessageWithStatus = {
            MessageID: Date.now(), 
            Channel: activeChannel,
            UserID: user?.id || 'UNKNOWN_USER',
            UserName: user?.FullName || 'Unknown User',
            MessageText: newMessage,
            SentAt: new Date().toISOString(),
            SentAtAsInt: Number(ISOtoInt(new Date().toISOString(), true)),
            status: 'sending'
        };

        // Update specific channel array
        setChannelMessages(prev => ({
            ...prev,
            [activeChannel]: [...(prev[activeChannel] || []), optimisticMessage]
        }));
        setNewMessage('');

        try {

            const payload = {
                Channel: optimisticMessage.Channel!,
                UserID: optimisticMessage.UserID!,
                UserName: optimisticMessage.UserName!,
                MessageText: optimisticMessage.MessageText!,
                SentAt: optimisticMessage.SentAt!,
                SentAtAsInt: optimisticMessage.SentAtAsInt!,
                RecipientUserID: activeChannel === 'Dev Bot' ? DEVBOT_USERID : activeChannel === 'IT Support' ? ITDEV_USERID : undefined,
            };
            
            const result = await ChatMessagesService.create(payload);

            if (activeChannel === 'Dev Bot') {
                const TEMP_BOT_ID = Date.now();
                let isThinking = true;
                let unusedPhrases = [...THINKING_PHRASES];

                const getNextPhrase = () => {
                    if (unusedPhrases.length === 0) {
                        return "Finalizing response..."; 
                    }
                    
                    const randomIndex = Math.floor(Math.random() * unusedPhrases.length);
                    const phrase = unusedPhrases[randomIndex];
                    
                    // Remove the picked phrase from the local pool
                    unusedPhrases.splice(randomIndex, 1);
                    return phrase;
                };
                const firstPhrase = getNextPhrase() || "Processing...";
                
                setChannelMessages(prev => ({
                    ...prev,
                    ['Dev Bot']: [...(prev['Dev Bot'] || []), {
                        MessageID: TEMP_BOT_ID,
                        Channel: 'Dev Bot',
                        UserID: DEVBOT_USERID,
                        UserName: 'Dev Bot',
                        MessageText: firstPhrase,
                        SentAt: new Date().toISOString(),
                        status: 'sending'
                    }]
                }));

                const rotateText = () => {
                    if (!isThinking) return; // Stop if the response is back
                    
                    const nextPhrase = getNextPhrase();
                    if (!nextPhrase) return;
                    const randomDelay = Math.floor(Math.random() * (8000 - 3500 + 1) + 1500); // 1.5s to 4s

                    setChannelMessages(prev => ({
                        ...prev,
                        ['Dev Bot']: (prev['Dev Bot'] || []).map(m => 
                            m.MessageID === TEMP_BOT_ID ? { ...m, MessageText: `[THINK:${nextPhrase}]` } : m
                        )
                    }));

                    setTimeout(rotateText, randomDelay);
                };
                rotateText(); // start


                const botResponseText = await handleDevBotChat(userMsgText);
                
                isThinking = false; // stop the thinking text rotation
                const botPayload = {
                    Channel: 'Dev Bot',
                    UserID: DEVBOT_USERID,
                    UserName: 'Dev Bot',
                    MessageText: botResponseText,
                    SentAt: new Date().toISOString(),
                    SentAtAsInt: Number(ISOtoInt(new Date().toISOString(), true)),
                    RecipientUserID: user.id,
                };


                setChannelMessages(prev => {
                    const filtered = (prev['Dev Bot'] || []).filter(m => m.MessageID !== TEMP_BOT_ID);
                    return {
                        ...prev,
                        ['Dev Bot']: [...filtered, { ...botPayload, MessageID: Date.now() + 1, status: 'sent' }]
                    };
                });
                
                ChatMessagesService.create(botPayload); // Fire and forget the bot response to save in DB



            } else {
                
                setChannelMessages(prev => ({
                    ...prev,
                    [activeChannel]: prev[activeChannel].map(msg => 
                        msg.MessageID === optimisticMessage.MessageID ? { ...result.data, status: 'sent' } : msg
                    )
                }));
            }


        } catch (error) {
            console.error("Failed to send message:", error);
            setChannelMessages(prev => ({
                ...prev,
                [activeChannel]: prev[activeChannel].map(msg => 
                    msg.MessageID === optimisticMessage.MessageID ? { ...msg, status: 'failed' } : msg
                )
            }));
        }
    };

    const handleDevBotChat = async (userMessage: string) => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL;
        const secretKey = user?.Position === 'Developer' ? import.meta.env.VITE_DEV_BOT_SECRETDEV : import.meta.env.VITE_DEV_BOT_SECRET;
        
        const now = new Date().toLocaleString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });

        const historyData = (channelMessages['Dev Bot'] || []).slice(-20);
        const historyMD = historyData.length > 0 
            ? "### CHAT HISTORY (For Reference):\n" + historyData.map(msg => {
                const role = msg.UserID === user?.id ? 'User' : 'Dev Bot';
                const msgTime = new Date(msg.SentAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `- [${msgTime}] **${role}**: ${msg.MessageText}`;
            }).join("\n")
            : "_No previous history._";
        const fullMDPrompt = `
> **Context:** Current System Time is ${now}.
> **Context2:** You are Dev Bot, a helpful assistant for GSDC employees. Answer based on the current message and the conversation history. If you don't know the answer, say you don't know. Be concise & Fast.

## RESPONSE GUIDELINES
1. **Think Simple for Simple Questions:** If the prompt doesn't require calculations, provide a simple and direct answer. Example: "What time is it?" or "Hi Dev Bot!" should not trigger a long, detailed response.
2. **No Echoing:** Do not repeat the user's question or use phrases like "To answer your question about..." or "You asked..." or "CURRENT USER PROMPT:...". 
3. **Direct Starts:** Start the response immediately with the answer or the code requested.
4. **Third-Person Ban:** Do not refer to yourself as "Dev Bot," "an AI," or "Assistant." 
5. **Contextual Awareness:** Maintain the flow of conversation without summarizing the chat history in every response.
6. **Formatting:** Use a clean Markdown format for more readability.

---
### CURRENT USER PROMPT:
${userMessage}
---

${historyMD}
    `.trim();
        // console.log('Full MD Prompt:', fullMDPrompt);
        try {
            // 1. Authenticate to get a Session Token
            const authRes = await fetch(`${baseUrl}/api/llm-auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id, secretKey })
            });

            if (!authRes.ok) throw new Error("Auth failed");
            const { token } = await authRes.json();

            // 2. Send the message to your new protected Ollama endpoint
            const chatRes = await fetch(`${baseUrl}/api/ollm/chatDispApp`, {
                method: 'POST',
                headers: { 
                    'Authorization': token,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ message: fullMDPrompt})
            });

            const data = await chatRes.json();
            
            if (chatRes.status === 429) return "Daily limit reached.";
            return data.answer;

        } catch (err) {
            console.error("DevBot Error:", err);
            return "I'm having trouble connecting to the server right now.";
        }
    };

  if (isMinimized && isOpen) {
    return (
      <Draggable nodeRef={minimizedNodeRef}>
        <div 
          ref={minimizedNodeRef} 
          className={`chatbox-minimized ${hasUnreadMessages ? 'has-unread' : ''}`} 
          onClick={() => setIsMinimized(false)}
        >
          <MessageSquare size={24} />
        </div>
      </Draggable>
    );
  }

  if (isOpen) {
        return ReactDOM.createPortal(
            <div className={isMaximized ? "chatbox-maximized-wrapper" : ""}>
            <Draggable handle=".chatbox-header" nodeRef={nodeRef} disabled={isMaximized}>
            <div 
                ref={nodeRef} 
                className={`chatbox-container ${isMaximized ? 'maximized' : ''}`}
                style={isMaximized ? { transform: 'none' } : {}} // Reset draggable transform
                >
                <div className="chatbox-sidebar">
                    <div className="chatbox-sidebar-header">
                        <h3>Channels</h3>
                    </div>
                    <ul className="chatbox-channels">
                        {CHANNELS.map(channel => (
                            <li 
                                key={channel} 
                                className={`channel-item ${activeChannel === channel ? 'active' : ''}`}
                                onClick={() => {setUnreadCounts(prev => ({ ...prev, [channel]: 0 })); handleChannelClick(channel);}}
                            >
                                <span># {channel}</span>
                                {unreadCounts[channel] > 0 && activeChannel !== channel && (
                                    <span className="unread-badge">
                                        {unreadCounts[channel] > 99 ? '99+' : unreadCounts[channel]}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="chatbox-main">
                    <div className="chatbox-header">
                    <h2>{activeChannel}</h2>
                    <div className="chatbox-controls">
                        <button onClick={() => setIsMaximized(!isMaximized)} className="chatbox-control-btn">
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        <button onClick={() => setIsMinimized(true)} className="chatbox-control-btn">
                        <Minus size={20} />
                        </button>
                        <button onClick={onClose} className="chatbox-control-btn">
                        <X size={20} />
                        </button>
                    </div>
                    </div>
                    <div className="chatbox-body" ref={chatBodyRef}>
                    {(isLoading && (channelMessages[activeChannel] || []).length === 0) ? (
                        <>
                            <div className="skeleton-bubble theirs"></div>
                            <div className="skeleton-bubble theirs"></div>
                            <div className="skeleton-bubble mine"></div>
                            <div className="skeleton-bubble theirs"></div>
                            <div className="skeleton-bubble mine"></div>
                            <div className="skeleton-bubble mine"></div>
                            <div className="skeleton-bubble mine"></div>
                        </>
                    ) : (
                        (channelMessages[activeChannel] || []).map((msg) => {
                            const isMine = msg.UserID === user?.id;
                            
                            return (
                                <div key={msg.MessageID} className={`chat-message ${isMine ? 'mine' : ''}`}>
                                    <div className="message-sender">{isMine ? 'You' : msg.UserName}</div>
                                    <div className="message-text">
                                        {renderMessageText(msg.MessageText || '', (oe) => {
                                            // Trigger the navigation event we built earlier
                                            const event = new CustomEvent(GSDC_NAVIGATE_TO_TRIP_key, { 
                                                detail: { oe } 
                                            });
                                            window.dispatchEvent(event);
                                        }, isMine)}
                                    </div>
                                    <div className="message-time">
                                        {new Date(msg.SentAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    </div>
                    <div className="chatbox-footer">
                        <input 
                            type="text" 
                            placeholder={`Message #${activeChannel}`} 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button onClick={handleSendMessage}>Send</button>
                    </div>
                </div>
            </div>
            </Draggable></div>,
            document.body
        );
    }
});

export default ChatBox;
