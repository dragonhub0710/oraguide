import React from "react";
import { Typography } from "@material-tailwind/react";

const UserChatBubble = (props) => {
  return (
    <div className="flex w-full justify-end">
      <div className="w-fit max-w-[80%] rounded-s-xl rounded-ee-xl border-[1px] border-[gray] px-4 py-2">
        <Typography className="text-base font-normal">
          {props.content}
        </Typography>
      </div>
    </div>
  );
};

export default UserChatBubble;
