import { Form, useTranslate, useUpdate } from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { Link2, UserRound } from "lucide-react";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Conversation } from "./types";

/**
 * The counterparty of a conversation (TZ section 5.2: a dialog belongs to a
 * counterparty card): a link to it, or a way to pick an existing one or to
 * create a new one with the name and phone of the chat.
 */
export const ClientLink = ({
  conversation,
  name,
}: {
  conversation: Conversation;
  name: string;
}) => {
  const translate = useTranslate();
  const [update] = useUpdate<Conversation>();
  const [picking, setPicking] = useState(false);

  if (conversation.client_id != null) {
    return (
      <Link
        to={`/companies/${conversation.client_id}/show`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <UserRound />
        {translate("crm.chats.client_card")}
      </Link>
    );
  }

  const newClient = encodeURIComponent(
    JSON.stringify({
      name,
      phone_number: conversation.phone ?? "",
      kind: "person",
      roles: ["client"],
    }),
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
        <Link2 />
        {translate("crm.chats.link_client")}
      </Button>
      {picking ? (
        <Dialog open onOpenChange={(open) => setPicking(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{translate("crm.chats.link_client")}</DialogTitle>
            </DialogHeader>
            <Form
              defaultValues={{ client_id: null }}
              onSubmit={(values: { client_id?: Conversation["client_id"] }) =>
                update(
                  "conversations",
                  {
                    id: conversation.id,
                    data: { client_id: values.client_id },
                    previousData: conversation,
                  },
                  { onSuccess: () => setPicking(false) },
                )
              }
            >
              <ReferenceInput source="client_id" reference="companies">
                <AutocompleteInput
                  label={translate("resources.bookings.fields.client_id")}
                  helperText={false}
                />
              </ReferenceInput>
              <DialogFooter className="mt-4 flex-wrap gap-2">
                <Link
                  to={`/companies/create?source=${newClient}`}
                  className={buttonVariants({ variant: "ghost" })}
                >
                  {translate("crm.chats.new_client")}
                </Link>
                <Button type="submit">{translate("ra.action.save")}</Button>
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
