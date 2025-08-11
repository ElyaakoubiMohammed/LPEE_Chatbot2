import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  MessageCircle, 
  Plus, 
  Send, 
  Mic, 
  Image as ImageIcon, 
  Edit3, 
  Save, 
  X, 
  Trash2,
  Bot,
  User,
  Sparkles,
  Zap,
  Brain,
  Cpu
} from 'lucide-react';
import './App.css';

function App() {
  const [conversations, setConversations] = useState({});
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, currentConversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/conversations');
      setConversations(response.data);
      
      if (Object.keys(response.data).length > 0 && !currentConversationId) {
        setCurrentConversationId(Object.keys(response.data)[0]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const createNewConversation = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/conversations');
      const newId = response.data.id;
      
      await fetchConversations();
      setCurrentConversationId(newId);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const deleteConversation = async (conversationId) => {
    try {
      await axios.delete(`http://localhost:5000/api/conversations/${conversationId}`);
      await fetchConversations();
      
      if (conversationId === currentConversationId) {
        const remainingIds = Object.keys(conversations).filter(id => id !== conversationId);
        setCurrentConversationId(remainingIds.length > 0 ? remainingIds[0] : null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentConversationId || isLoading) return;

    const userMessage = message;
    setMessage('');
    setIsLoading(true);

    try {
      const currentMessages = conversations[currentConversationId]?.messages || [];
      const response = await axios.post('http://localhost:5000/api/chat', {
        messages: [...currentMessages, { role: 'user', content: userMessage }],
        conversationId: currentConversationId
      });

      await fetchConversations();
      
      if (conversations[currentConversationId]?.title === "Untitled") {
        await updateTitle(currentConversationId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateTitle = async (conversationId) => {
    try {
      const messages = conversations[conversationId]?.messages || [];
      await axios.post('http://localhost:5000/api/update-title', {
        conversationId,
        messages
      });
      await fetchConversations();
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
          const response = await axios.post('http://localhost:5000/api/stt', formData);
          setMessage(response.data.text);
        } catch (error) {
          console.error('Error with speech-to-text:', error);
        }

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !currentConversationId) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('prompt', message || 'What do you see in this image?');
    formData.append('conversationId', currentConversationId);

    setMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/chat-with-image', formData);
      await fetchConversations();
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (index, content) => {
    setEditingMessageIndex(index);
    setEditingContent(content);
  };

  const saveEdit = async () => {
    if (!currentConversationId || editingMessageIndex === null) return;

    try {
      const response = await axios.post('http://localhost:5000/api/edit-message', {
        conversationId: currentConversationId,
        messageIndex: editingMessageIndex,
        newContent: editingContent
      });

      await fetchConversations();
      setEditingMessageIndex(null);
      setEditingContent('');
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const cancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentMessages = currentConversationId ? conversations[currentConversationId]?.messages || [] : [];

  return (
    <div className="app">
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
        <div className="bg-orb orb-4"></div>
        <div className="floating-particles">
          {[...Array(20)].map((_, i) => (
            <div key={i} className={`particle particle-${i + 1}`}></div>
          ))}
        </div>
      </div>

      <div className="app-container">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="brand">
              <div className="brand-icon">
                <Brain className="icon" />
                <div className="icon-glow"></div>
              </div>
              <div className="brand-text">
                <h1>LPEE AI</h1>
                <span className="brand-subtitle">Neural Assistant</span>
              </div>
            </div>
          </div>

          <button className="new-chat-btn" onClick={createNewConversation}>
            <div className="btn-content">
              <Plus className="btn-icon" />
              <span>New Conversation</span>
              <Sparkles className="btn-accent" />
            </div>
            <div className="btn-shimmer"></div>
          </button>

          <div className="conversations">
            <div className="conversations-header">
              <h3>Recent Chats</h3>
              <div className="chat-count">{Object.keys(conversations).length}</div>
            </div>
            
            <div className="conversations-list">
              {Object.entries(conversations).map(([id, conv]) => (
                <div key={id} className="conversation-item">
                  <button
                    className={`conversation-btn ${currentConversationId === id ? 'active' : ''}`}
                    onClick={() => setCurrentConversationId(id)}
                  >
                    <div className="conv-icon">
                      <MessageCircle />
                    </div>
                    <div className="conv-content">
                      <span className="conv-title">{conv.title}</span>
                      <span className="conv-preview">
                        {conv.messages.length > 0 
                          ? conv.messages[conv.messages.length - 1].content.substring(0, 50) + '...'
                          : 'No messages yet'
                        }
                      </span>
                    </div>
                    {currentConversationId === id && <div className="active-indicator"></div>}
                    }
                  </button>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(id);
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="main-content">
          <div className="chat-header">
            <div className="header-left">
              <div className="chat-avatar">
                <Cpu className="avatar-icon" />
                <div className="avatar-pulse"></div>
              </div>
              <div className="chat-info">
                <h2>AI Assistant</h2>
                <div className="status">
                  <div className="status-dot"></div>
                  <span>Online & Ready</span>
                </div>
              </div>
            </div>
            <div className="header-right">
              <div className="neural-activity">
                <div className="neural-dot"></div>
                <div className="neural-dot"></div>
                <div className="neural-dot"></div>
              </div>
            </div>
          </div>

          <div className="messages-container">
            {currentMessages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-animation">
                  <div className="floating-brain">
                    <Brain className="brain-icon" />
                    <div className="brain-waves">
                      <div className="wave wave-1"></div>
                      <div className="wave wave-2"></div>
                      <div className="wave wave-3"></div>
                    </div>
                  </div>
                </div>
                <h3>Ready to assist you</h3>
                <p>Start a conversation and let's explore ideas together</p>
                <div className="quick-actions">
                  <button className="quick-btn">Ask a question</button>
                  <button className="quick-btn">Get help</button>
                  <button className="quick-btn">Start creating</button>
                </div>
              </div>
            ) : (
              <div className="messages">
                {currentMessages.map((msg, index) => (
                  <div key={index} className={`message-wrapper ${msg.role}`}>
                    <div className="message">
                      <div className="message-avatar">
                        {msg.role === 'user' ? (
                          <User className="avatar-icon" />
                        ) : (
                          <Bot className="avatar-icon" />
                        )}
                        <div className="avatar-glow"></div>
                      </div>
                      
                      <div className="message-content">
                        <div className="message-header">
                          <span className="sender">{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                          <span className="timestamp">now</span>
                        </div>
                        
                        {editingMessageIndex === index ? (
                          <div className="edit-container">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="edit-textarea"
                            />
                            <div className="edit-actions">
                              <button onClick={saveEdit} className="save-btn">
                                <Save size={16} />
                                Save
                              </button>
                              <button onClick={cancelEdit} className="cancel-btn">
                                <X size={16} />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="message-text">{msg.content}</div>
                        )}
                        
                        {msg.role === 'user' && editingMessageIndex !== index && (
                          <button
                            className="edit-btn"
                            onClick={() => startEditing(index, msg.content)}
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="message-wrapper assistant">
                    <div className="message">
                      <div className="message-avatar">
                        <Bot className="avatar-icon" />
                        <div className="avatar-glow loading"></div>
                      </div>
                      <div className="message-content">
                        <div className="message-header">
                          <span className="sender">AI Assistant</span>
                          <span className="timestamp">thinking...</span>
                        </div>
                        <div className="typing-indicator">
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                          <div className="typing-dot"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="input-area">
            <div className="input-container">
              <div className="input-wrapper">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="message-input"
                  rows="1"
                />
                
                <div className="input-actions">
                  <button
                    className={`action-btn mic-btn ${isRecording ? 'recording' : ''}`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                  >
                    <Mic />
                    {isRecording && <div className="recording-pulse"></div>}
                    }
                  </button>
                  
                  <label className="action-btn image-btn">
                    <ImageIcon />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  
                  <button
                    className="send-btn"
                    onClick={sendMessage}
                    disabled={!message.trim() || isLoading}
                  >
                    <Send />
                    <div className="send-ripple"></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;