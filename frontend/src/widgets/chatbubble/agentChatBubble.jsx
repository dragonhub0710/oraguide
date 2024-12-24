import React from "react";
import { Typography } from "@material-tailwind/react";

const AgentChatBubble = (props) => {
  return (
    <div className="w-full">
      <div className="w-fit max-w-[80%] rounded-e-xl rounded-es-xl border-[1px] border-[gray] px-4 py-2">
        <div className="prose">
          <div
            dangerouslySetInnerHTML={{
              __html: props.content.replace(/\n/g, "<br/>"),
            }}
            className="text-base font-normal"
          />
        </div>
      </div>
    </div>
  );
};

export default AgentChatBubble;
