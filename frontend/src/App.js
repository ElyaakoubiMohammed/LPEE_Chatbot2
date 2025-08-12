import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

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
      let isImage = false;

      if (selectedImage) {
        isImage = true;

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
        btn.innerHTML = "✓";
        setTimeout(() => {
          btn.classList.remove("copied");
          btn.innerHTML = "📋";
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
    <div className={`app-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          <h1 className="app-title">LPEE</h1>
          <button className="new-conversation-btn" onClick={createNewConversation}>+ New Chat</button>
          <div className="conversations-list">
            {Object.keys(conversations).map((cid) => (
              <div key={cid} className="conversation-item">
                <button
                  className="conversation-btn"
                  onClick={() => switchConversation(cid)}
                >
                  {conversations[cid]?.title || "Chat"}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => deleteConversation(cid)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
        <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? '«' : '»'}
        </button>
      </aside>

      {/* MAIN CONTENT */}
      <main className="chat-container">
        <header className="chat-header">
          <h2>{conversations[currentConversation]?.title || "Chat"}</h2>
        </header>
        <section className="message-area">
          {currentConversation &&
            conversations[currentConversation].messages?.length === 0 && (
              <div className="empty-state">No messages yet. Start the conversation.</div>
            )}
          {currentConversation &&
            conversations[currentConversation].messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${msg.role} animate${editingMessage === index ? ' editing' : ''}`}
                onContextMenu={(e) => handleRightClick(e, index)}
              >
                <div className="message-actions">
                  <button
                    className="copy-btn"
                    data-tooltip="Copy"
                    onClick={() => copyToClipboard(msg.content)}
                    aria-label="Copy message"
                  >
                    <span>📋</span>
                  </button>
                  {msg.role === 'user' && (
                    <button
                      className="edit-btn"
                      data-tooltip="Edit"
                      onClick={() => {
                        setEditingMessage(index);
                        setEditedMessage(msg.content);
                      }}
                      aria-label="Edit message"
                    >
                      <span>✏️</span>
                    </button>
                  )}
                </div>

                <div className="message-content">
                  {editingMessage === index ? (
                    <textarea
                      autoFocus
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                    />
                  ) : (
                    msg.content
                  )}
                </div>

                {editingMessage === index && (
                  <>
                    <button
                      className="save-edit-btn"
                      onClick={handleEditSave}
                      disabled={thinking}
                    >
                      {thinking ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="cancel-edit-btn"
                      onClick={() => {
                        setEditingMessage(null);
                        setEditedMessage('');
                      }}
                      disabled={thinking}
                    >
                      <span role="img" aria-label="Cancel">✕</span>
                      Cancel
                    </button>
                  </>
                )}
              </div>
            ))}
          {thinking && (
            <div className="thinking-indicator">
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </div>
          )}
        </section>

        <footer className="input-area">
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
          <div className="input-buttons">
            <button
              className={`mic-btn ${isRecording ? 'active' : ''}`}
              onClick={toggleRecording}
              title={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 1v11" />
                  <path d="M19 11a7 7 0 0 1-14 0" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>

            {/* Image Upload Button */}
            <label htmlFor="image-upload" className="image-btn" title="Upload image">
              <span>🖼️</span>
            </label>
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e)}
            />

            <button className="send-btn" onClick={sendMessage}>
              <span>→</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;