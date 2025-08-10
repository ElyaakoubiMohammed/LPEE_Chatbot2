import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import { MessageCircle, Plus, Trash2, Send, Mic, Image as ImageIcon, Edit3, Copy, Check } from 'lucide-react';

function App() {
  const [conversations, setConversations] = useState({});
  const [currentConversation, setCurrentConversation] = useState(null);
  const [message, setMessage] = useState('');
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editedMessage, setEditedMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);

  // Load conversations on start
  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    const adjustHeight = () => {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto'; // Reset height
      textarea.style.height = `${textarea.scrollHeight}px`; // Auto-resize
    };
    adjustHeight();
  }, [message]);

  const fetchConversations = () => {
    axios.get('http://127.0.0.1:5000/api/conversations')
      .then(response => {
        const raw = response.data;
        const parsed = {};
        Object.entries(raw).forEach(([id, convo]) => {
          parsed[id] = {
            title: convo.title || "New conversation",
            messages: convo.messages || []
          };
        });
        setConversations(parsed);
        if (Object.keys(parsed).length > 0 && !currentConversation) {
          setCurrentConversation(Object.keys(parsed)[0]);
        }
      })
      .catch(err => console.error("Error fetching convos:", err));
  };


  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedImage(file);
    alert("Image selected. Click Send to send it.");
  };

  const switchConversation = (conversationId) => {
    setCurrentConversation(conversationId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const createNewConversation = () => {
    axios.post('http://127.0.0.1:5000/api/conversations')
      .then(response => {
        const newId = response.data.id;
        setConversations(prev => ({
          ...prev,
          [newId]: {
            title: "New conversation",
            messages: []
          }
        }));
        setCurrentConversation(newId);
        if (window.innerWidth < 768) setSidebarOpen(false);
      })
      .catch(err => console.error("Error creating convo:", err));
  };

  const deleteConversation = (conversationId) => {
    axios.delete(`http://127.0.0.1:5000/api/conversations/${conversationId}`)
      .then(() => {
        const updatedConvos = { ...conversations };
        delete updatedConvos[conversationId];
        setConversations(updatedConvos);
        if (currentConversation === conversationId) {
          setCurrentConversation(null);
        }
      })
      .catch(err => console.error("Error deleting convo:", err));
  };

  const sendMessage = async () => {
    if (!message.trim() && !selectedImage) return; // No input

    const updatedConvos = { ...conversations };

    if (selectedImage) {
      updatedConvos[currentConversation].messages.push({
        role: 'user',
        content: message
          ? `![Uploaded Image](data:image/png;base64,${selectedImage.name})\n\n${message}`
          : `![Uploaded Image](data:image/png;base64,${selectedImage.name})`
      });
    } else {
      updatedConvos[currentConversation].messages.push({
        role: 'user',
        content: message,
      });
    }

    setMessage('');
    setThinking(true);
    setConversations(updatedConvos);

    try {
      let response;

      if (selectedImage) {

        const formData = new FormData();
        formData.append('image', selectedImage);
        if (message.trim()) formData.append('prompt', message);

        response = await axios.post('http://localhost:5000/api/chat-with-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        console.log('Image API response data:', response.data);


      } else {
        response = await axios.post('http://127.0.0.1:5000/api/chat', {
          conversationId: currentConversation,
          messages: updatedConvos[currentConversation].messages,
        });
      }

      const newMessages = [...updatedConvos[currentConversation].messages];

      newMessages.push({
        role: 'assistant',
        content: response.data.content || "⚠️ Empty response from model.",
      });

      updatedConvos[currentConversation] = {
        ...updatedConvos[currentConversation],
        messages: newMessages,
      };

      setConversations(updatedConvos);
      setSelectedImage(null);
      setThinking(false);

      if (updatedConvos[currentConversation].messages.length >= 4) {
        await axios.post('http://127.0.0.1:5000/api/update-title', {
          conversationId: currentConversation,
          messages: updatedConvos[currentConversation].messages,
        });

      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to get a response from the server.");
      setThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault(); // Prevent newline
        sendMessage();
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.activeElement;
      if (btn) {
        btn.classList.add("copied");
        btn.textContent = "✔️";
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.textContent = "📋";
        }, 1200);
      }
    }).catch(err => {
      console.error("Failed to copy text: ", err);
    });
  };

  const handleRightClick = (e, messageIndex) => {
    e.preventDefault();
    if (e.target.closest('.message.user')) {
      setEditingMessage(messageIndex);
      setEditedMessage(conversations[currentConversation].messages[messageIndex].content);
    }
  };

  const handleEditSave = async () => {
    if (!editedMessage.trim() || thinking) return;
    setThinking(true);

    const updatedConvos = { ...conversations };
    const messages = [...updatedConvos[currentConversation].messages];

    messages[editingMessage] = {
      role: 'user',
      content: editedMessage,
    };

    messages.splice(editingMessage + 1); // Remove below

    updatedConvos[currentConversation] = {
      ...updatedConvos[currentConversation],
      messages: [...messages], // Ensure immutability
    };

    setConversations(updatedConvos); // Immediate UI update
    setEditingMessage(null); // Hide edit box immediately

    try {
      const res = await axios.post('http://127.0.0.1:5000/api/edit-message', {
        conversationId: currentConversation,
        messageIndex: editingMessage,
        newContent: editedMessage,
      });

      if (res.data.error) {
        alert("Edit failed: " + res.data.error);
      } else {
        const finalConvos = { ...updatedConvos };
        finalConvos[currentConversation].messages.push({
          role: 'assistant',
          content: res.data.content,
        });
        setConversations(finalConvos);
      }
    } catch (err) {
      console.error("Error editing message:", err);
      alert("Error editing message");
    } finally {
      setThinking(false);
      setEditedMessage('');
    }
  };

  // ===== VOICE INPUT LOGIC =====

  // Replace startRecording and stopRecording with toggleRecording:
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

          const formData = new FormData();
          formData.append('audio', blob, 'voice.wav');

          try {
            const res = await axios.post('http://127.0.0.1:5000/api/stt', formData, {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            });

            if (res.data.text) {
              setMessage(prev => prev + ' ' + res.data.text.trim());
            }
          } catch (err) {
            console.error("STT request failed:", err);
            alert("❌ Error converting speech to text");
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Microphone error:", err);
        alert("⚠️ Could not access microphone.");
      }
    }
  };


  // ===== RETURN JSX =====

  return (
    <div className="app-container">
      <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div className="app-logo">
              <MessageCircle className="logo-icon" />
              <h1 className="app-title">LPEE</h1>
            </div>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <div className="hamburger">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
          </div>
          
          <button className="new-conversation-btn" onClick={createNewConversation}>
            <Plus className="btn-icon" />
            <span>New Chat</span>
          </button>
          
          <div className="conversations-list">
            {Object.keys(conversations).map((cid) => (
              <div key={cid} className="conversation-item">
                <button
                  className={`conversation-btn ${currentConversation === cid ? 'active' : ''}`}
                  onClick={() => switchConversation(cid)}
                >
                  <MessageCircle className="conversation-icon" />
                  <span className="conversation-title">{conversations[cid]?.title || "New Chat"}</span>
                </button>
                <button
                  className="delete-btn"
                  onClick={() => deleteConversation(cid)}
                >
                  <Trash2 className="delete-icon" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="chat-container">
        <header className="chat-header">
          <div className="header-content">
            <button 
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <div className="hamburger">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </button>
            <h2 className="chat-title">{conversations[currentConversation]?.title || "New Conversation"}</h2>
            <div className="header-actions">
              <div className="status-indicator online"></div>
            </div>
          </div>
        </header>
        
        <section className="message-area">
          {currentConversation &&
            conversations[currentConversation].messages?.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">
                  <MessageCircle />
                </div>
                <h3>Start a conversation</h3>
                <p>Send a message to begin chatting with LPEE</p>
              </div>
            )}
            
          {currentConversation &&
            conversations[currentConversation].messages.map((msg, index) => (
              <div
                key={index}
                className={`message-wrapper ${msg.role}`}
                onContextMenu={(e) => handleRightClick(e, index)}
              >
                <div className={`message ${msg.role} ${editingMessage === index ? 'editing' : ''}`}>
                  <div className="message-content">
                    {editingMessage === index ? (
                      <div className="edit-container">
                        <textarea
                          autoFocus
                          value={editedMessage}
                          onChange={(e) => setEditedMessage(e.target.value)}
                          className="edit-textarea"
                        />
                        <div className="edit-actions">
                          <button
                            className="save-btn"
                            onClick={handleEditSave}
                            disabled={thinking}
                          >
                            <Check className="btn-icon" />
                            {thinking ? "Saving..." : "Save"}
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={() => {
                              setEditingMessage(null);
                              setEditedMessage('');
                            }}
                            disabled={thinking}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="message-text">{msg.content}</div>
                    )}
                  </div>
                  
                  <div className="message-actions">
                    <button
                      className="action-btn copy-btn"
                      onClick={() => copyToClipboard(msg.content)}
                      title="Copy message"
                    >
                      <Copy className="action-icon" />
                    </button>

                    {msg.role === 'user' && (
                      <button
                        className="action-btn edit-btn"
                        onClick={() => {
                          setEditingMessage(index);
                          setEditedMessage(msg.content);
                        }}
                        title="Edit message"
                      >
                        <Edit3 className="action-icon" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
          {thinking && (
            <div className="thinking-indicator">
              <div className="typing-animation">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
              <span className="typing-text">LPEE is typing...</span>
            </div>
          )}
        </section>

        <footer className="input-area">


          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="message-input"
                rows={1}
                disabled={editingMessage !== null}
              />
              
              <div className="input-actions">
                <button
                  className={`action-btn mic-btn ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  title={isRecording ? "Stop recording" : "Start recording"}
                >
                  <Mic className="action-icon" />
                </button>

                <label htmlFor="image-upload" className="action-btn image-btn" title="Upload image">
                  <ImageIcon className="action-icon" />
                </label>
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e)}
                />

                <button 
                  className="send-btn" 
                  onClick={sendMessage}
                  disabled={!message.trim() && !selectedImage}
                >
                  <Send className="send-icon" />
                </button>
              </div>
            </div>
          </div>
        </footer>
      </main>
      </div>
    </div>
  );
}

export default App;