import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, Users, Wand2, Grab, Info } from "lucide-react";
import { motion } from "framer-motion";



export default function AboutPanel() {

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="w-96 elegant-shadow bg-white/95 backdrop-blur-sm border-0 dark:border-gray-700">
        <CardHeader className="pb-3 drag-handle">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">Times Past</h3>
            </div>
            <Grab className="w-4 h-4 text-gray-400" />
          </div>
        </CardHeader>

        <CardContent>


            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Historical Analysis Engine</p>

              <p className="text-xs text-gray-400 mt-2">Times Past is created by and copyright Michael Keen 2026 and is liscenced under the creative commons liscence CC <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode.en">BY-NC-ND 4.0.</a></p>
            </div>

<div>
<a href="https://www.patreon.com/cw/timespast" target="_blank"><img src="public/tplogo.png" style={{ width: '50%', height: 'auto' }}/></a>
</div>

        </CardContent>
      </Card>
    </motion.div>
  );
}
