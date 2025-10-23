// import type { Message } from "../models/Message";

// interface MessageUpdateProps {
//   message: Message;
//   currentUid: string | undefined;
//     images: { id: string; url: string }[];
//     openImageViewer: (startIndex: number) => void;
// }
// export default function MessageUpdate(message: Message) {
//           const isMine = message.senderId === currentUid;
//           const tsMs = message.timestamp?.toMillis?.() ?? 0;
//           const canEdit =
//             isMine && Date.now() - tsMs <= EDIT_WINDOW_MS && !message.deleted;
//           const imgIndex = message.imageUrl
//             ? images.findIndex((img) => img.id === message.id)
//             : -1;

//           return (
//             <div
//               key={message.id}
//               className={`d-flex flex-column mb-3 ${
//                 isMine ? "align-items-end" : "align-items-start"
//               }`}
//               onMouseEnter={() => setHoveredMsgId(message.id)}
//               onMouseLeave={() =>
//                 setHoveredMsgId((id) => (id === message.id ? null : id))
//               }
//             >
//               {/* message bubble + actions */}
//               <div style={{ position: "relative", maxWidth: "70%" }}>
//                 <div
//                   className={`${message.imageUrl ? "" : "p-2"} rounded-3 shadow ${
//                     isMine
//                       ? "bg-success bg-opacity-80 text-white"
//                       : "bg-white border"
//                   }`}
//                   style={{ wordBreak: "break-word" }}
//                 >
//                   {message.deleted ? (
//                     <em className="text-muted">message was deleted</em>
//                   ) : editingMsgId === message.id ? (
//                     <div className="d-flex gap-2 align-items-center">
//                       <input
//                         className="form-control form-control-sm"
//                         value={editingText}
//                         onChange={(e) => setEditingText(e.target.value)}
//                       />
//                       <div className="btn-group">
//                         <button
//                           className="btn btn-sm btn-primary"
//                           onClick={() => saveEdit(message)}
//                         >
//                           Save
//                         </button>
//                         <button
//                           className="btn btn-sm btn-secondary"
//                           onClick={cancelEdit}
//                         >
//                           Cancel
//                         </button>
//                       </div>
//                     </div>
//                   ) : (
//                     <>
//                       {message.imageUrl && (
//                         <img
//                           src={message.imageUrl}
//                           alt="sent"
//                           className="img-fluid rounded"
//                           style={{
//                             display: "block",
//                             margin: "0 auto",
//                             objectFit: "contain",
//                             width: "100%",
//                             maxWidth: "320px",
//                             height: "auto",
//                             cursor: "zoom-in",
//                           }}
//                           onClick={() =>
//                             imgIndex >= 0 && openImageViewer(imgIndex)
//                           }
//                         />
//                       )}

//                       <div style={{ whiteSpace: "pre-wrap" }}>
//                         {message.text}
//                         {message.edited && !message.deleted ? (
//                           <small
//                             className={`ms-2 ${
//                               isMine ? "text-white-50" : "text-muted"
//                             }`}
//                             style={{ fontStyle: "italic" }}
//                           >
//                             (edited)
//                           </small>
//                         ) : null}
//                       </div>
//                     </>
//                   )}
//                 </div>

//                 {/* hover actions for own, not deleted */}
//                 {isMine && !message.deleted && hoveredMsgId === message.id && (
//                   <div
//                     style={{
//                       position: "absolute",
//                       right: -6,
//                       top: -6,
//                       zIndex: 60,
//                     }}
//                   >
//                     <div
//                       className="btn-group shadow-sm"
//                       role="group"
//                       aria-label="message actions"
//                     >
//                       {canEdit && (
//                         <button
//                           className="btn btn-sm btn-light"
//                           onClick={() => startEdit(m)}
//                           title="Edit"
//                         >
//                           <i className="bi bi-pencil" />
//                         </button>
//                       )}
//                       <button
//                         className="btn btn-sm btn-light text-danger"
//                         onClick={() => confirmDelete(message.id)}
//                         title="Delete"
//                       >
//                         <i className="bi bi-trash" />
//                       </button>
//                     </div>
//                   </div>
//                 )}
//               </div>

//               {/* timestamp */}
//               <small className="text-muted mt-1" style={{ fontSize: 12 }}>
//                 {message.timestamp
//                   ? message.timestamp.toDate().toLocaleTimeString([], {
//                       hour: "2-digit",
//                       minute: "2-digit",
//                     })
//                   : ""}
//               </small>
//             </div>
//           );
//         })
//     }
